import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    // Connect to the socket server (proxied via Vite configuration or directly)
    const socketUrl = import.meta.env.VITE_API_URL || undefined
    const newSocket = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('[SOCKET] Connected to real-time server')
    })

    newSocket.on('connect_error', (err) => {
      console.error('[SOCKET] Connection error:', err.message)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [user])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
