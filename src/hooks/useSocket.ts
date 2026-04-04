import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/store';
import { SOCKET_BASE } from '../lib/api';
import { handlePredictionResultEvent } from '../lib/predictionResultHandler';

let globalSocket: Socket | null = null;
let globalSocketUserId: string | null = null;

// Singleton socket so navbar and match page share the same connection
export const useGlobalSocket = () => {
  const user = useStore((s) => s.user);

  useEffect(() => {
    if (!user?.id) {
      globalSocket?.disconnect();
      globalSocket = null;
      globalSocketUserId = null;
      return;
    }

    const needNewSocket =
      !globalSocket ||
      !globalSocket.connected ||
      globalSocketUserId !== user.id;

    if (needNewSocket) {
      globalSocket?.disconnect();
      globalSocket = io(SOCKET_BASE, {
        query: { userId: String(user.id) },
        transports: ['websocket'],
      });
      globalSocketUserId = user.id;
    }

    const sock = globalSocket!;

    const onNotif = (data: any) => {
      useStore.getState().addNotification(data);
    };

    const onWalletBalance = (data: { coinsBalance: number }) => {
      if (typeof data?.coinsBalance === 'number') {
        useStore.getState().updateCoins(data.coinsBalance);
      }
    };

    const onPredictionResult = handlePredictionResultEvent;

    sock.on('notification', onNotif);
    sock.on('prediction_result', onPredictionResult);
    sock.on('wallet_balance', onWalletBalance);

    return () => {
      sock.off('notification', onNotif);
      sock.off('prediction_result', onPredictionResult);
      sock.off('wallet_balance', onWalletBalance);
    };
  }, [user?.id]);

  return globalSocket;
};

export type MatchBetActivity = {
  totalBets: number;
  usersBetting: number;
  recentBets: Array<{
    id: string;
    userId: string;
    username: string;
    predictionValue: string;
    amountStaked: number;
    type: string;
    multiplier: number;
    createdAt?: string;
  }>;
};

export const useSocket = (
  matchId: string,
  onBetActivity?: (data: MatchBetActivity) => void,
) => {
  const socketRef = useRef<Socket | null>(null);
  const { updateBall, setPredictionsLocked, user } = useStore();
  const onBetActivityRef = useRef(onBetActivity);
  onBetActivityRef.current = onBetActivity;

  useEffect(() => {
    if (!matchId) return;

    const socket = io(SOCKET_BASE, {
      query: { userId: user?.id != null ? String(user.id) : '' },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_match', matchId);
    });

    socket.on('ball_update', (data) => {
      updateBall(data);
    });

    socket.on('prediction_lock', () => {
      setPredictionsLocked(true);
    });

    socket.on('notification', (data: any) => {
      useStore.getState().addNotification(data);
    });

    socket.on('wallet_balance', (data: { coinsBalance: number }) => {
      if (typeof data?.coinsBalance === 'number') {
        useStore.getState().updateCoins(data.coinsBalance);
      }
    });

    socket.on('bet_activity', (data: MatchBetActivity) => {
      onBetActivityRef.current?.(data);
    });

    socket.on('prediction_result', handlePredictionResultEvent);

    return () => {
      socket.off('prediction_result', handlePredictionResultEvent);
      socket.disconnect();
    };
  }, [matchId, user?.id]);

  return socketRef.current;
};
