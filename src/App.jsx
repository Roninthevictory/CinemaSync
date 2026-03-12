import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { io } from 'socket.io-client';
import { 
  Play, Pause, Link, Users, Film, Clock, Loader2, X, 
  Volume2, VolumeX, Maximize, Minimize, AlertCircle, 
  Mic, MicOff, MonitorPlay 
} from 'lucide-react';

const socket = io(window.location.origin);

function App() {
  const [sdk, setSdk] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [hostName, setHostName] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoState, setVideoState] = useState({
    url: null,
    isPlaying: false,
    timestamp: 0
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [notification, setNotification] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [guestsMuted, setGuestsMuted] = useState(true);
  const [participants, setParticipants] = useState([]);
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Initialize Discord SDK
  useEffect(() => {
    const initSdk = async () => {
      try {
        // Initialize with your Client ID from environment variables
        const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
        setSdk(discordSdk);
        
        await discordSdk.ready();
        console.log('SDK Ready');
        
        // Modern authorization syntax for Discord SDK 1.0.0+
        const { code } = await discordSdk.commands.authorize({
          client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
          response_type: 'code',
          scope: ['identify', 'guilds', 'rpc.activities.write.self'],
        });
        
        const tokenResponse = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        
        if (!tokenResponse.ok) throw new Error('Failed to authenticate with Discord');
        const tokenData = await tokenResponse.json();
        
        const userResponse = await fetch('/api/user', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        
        if (!userResponse.ok) throw new Error('Failed to get user info');
        const userData = await userResponse.json();
        
        setUser(userData);
        setAuthenticated(true);
        
        socket.emit('join_channel', {
          channelId: discordSdk.channelId,
          guildId: discordSdk.guildId,
          userId: userData.id,
          userName: userData.username
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    
    initSdk();
  }, []);

  // Socket event listeners
  useEffect(() => {
    socket.on('role_assigned', ({ isHost, hostId, hostName, videoUrl, isPlaying, timestamp, participants }) => {
      setIsHost(isHost);
      setHostId(hostId);
      setHostName(hostName);
      if (videoUrl) setVideoState({ url: videoUrl, isPlaying, timestamp });
      if (participants) setParticipants(Object.values(participants));
    });

    socket.on('video_state_update', (state) => {
      setVideoState(state);
      setHostId(state.hostId);
      setHostName(state.hostName);
      setGuestsMuted(state.guestsMuted || false);
      
      if (videoRef.current && state.url) {
        if (Math.abs(videoRef.current.currentTime - state.timestamp) > 0.5) {
          videoRef.current.currentTime = state.timestamp;
        }
        if (state.isPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(console.error);
        } else if (!state.isPlaying && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    });

    socket.on('became_host', ({ previousHost, videoUrl, isPlaying, timestamp, guestsMuted }) => {
      setIsHost(true);
      setVideoState({ url: videoUrl, isPlaying, timestamp });
      setGuestsMuted(guestsMuted);
      showNotification(`You are now the host! ${previousHost ? `(${previousHost} left)` : ''}`, 'success');
    });

    socket.on('host_changed', ({ newHostId, newHostName }) => {
      setHostId(newHostId);
      setHostName(newHostName);
      if (!isHost) showNotification(`${newHostName} is now the host`, 'info');
    });

    socket.on('session_ended', ({ endedBy }) => {
      setSessionEnded(true);
      setVideoState({ url: null, isPlaying: false, timestamp: 0 });
      showNotification(`Session ended by ${endedBy === 'host' ? 'host' : 'the system'}`, 'error');
    });

    socket.on('user_joined', ({ userName, participantCount, participantsList }) => {
      setParticipantCount(participantCount);
      if (participantsList) setParticipants(participantsList);
      showNotification(`${userName} joined the watch party`, 'info');
    });

    socket.on('user_left', ({ participantCount, participantsList }) => {
      setParticipantCount(participantCount);
      if (participantsList) setParticipants(participantsList);
    });

    return () => {
      socket.off('role_assigned');
      socket.off('video_state_update');
      socket.off('became_host');
      socket.off('host_changed');
      socket.off('session_ended');
      socket.off('user_joined');
      socket.off('user_left');
    };
  }, [isHost, showNotification]);

  // Handlers
  const handleVideoLoad = () => videoRef.current && setDuration(videoRef.current.duration);
  const handleTimeUpdate = () => videoRef.current && setCurrentTime(videoRef.current.currentTime);

  const handlePlay = () => {
    if (isHost && videoState.url) {
      socket.emit('video_control', { channelId: sdk?.channelId, action: 'play', data: { timestamp: videoRef.current?.currentTime || 0 } });
    }
  };

  const handlePause = () => {
    if (isHost && videoState.url) {
      socket.emit('video_control', { channelId: sdk?.channelId, action: 'pause', data: { timestamp: videoRef.current?.currentTime || 0 } });
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = time;
    if (isHost) {
      socket.emit('video_control', { channelId: sdk?.channelId, action: 'seek', data: { timestamp: time } });
    }
  };

  const handleSetUrl = (e) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    socket.emit('video_control', { channelId: sdk?.channelId, action: 'set_url', data: { url: videoUrl.trim() } });
    setVideoUrl('');
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (playerRef.current) {
      if (!document.fullscreenElement) {
        playerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Initializing CinemaSync...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md p-4">
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
        <button onClick={() => window.location.reload()} className="bg-purple-600 px-4 py-2 rounded-lg">Retry</button>
      </div>
    </div>
  );

  if (sessionEnded) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center">
      <div>
        <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Watch Party Ended</h2>
        <p className="text-gray-400">The host has ended this session.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-600' : 'bg-purple-600'}`}>
          <AlertCircle className="w-4 h-4" /> <span>{notification.message}</span>
        </div>
      )}

      <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Film className="text-purple-500 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">CinemaSync</h1>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="w-4 h-4" /> {participantCount}
          </div>
          <span className="text-sm font-medium px-3 py-1 bg-gray-800 rounded-full">{user?.username}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {isHost && (
          <form onSubmit={handleSetUrl} className="mb-6 flex gap-2">
            <input 
              type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste direct video URL..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
            />
            <button type="submit" className="bg-purple-600 px-6 py-2 rounded-lg font-bold hover:bg-purple-500 transition-colors">Load</button>
          </form>
        )}

        <div ref={playerRef} className="relative aspect-video bg-black rounded-xl shadow-2xl overflow-hidden group">
          {videoState.url ? (
            <video 
              ref={videoRef} src={videoState.url} className="w-full h-full"
              onLoadedMetadata={handleVideoLoad} onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay} onPause={handlePause} playsInline
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
              <MonitorPlay className="w-16 h-16 mb-4 opacity-20" />
              <p>{isHost ? 'Load a video to begin' : 'Waiting for host...'}</p>
            </div>
          )}
        </div>

        {videoState.url && (
          <div className="mt-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => videoState.isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
                disabled={!isHost} className="p-2 bg-purple-600 rounded-full disabled:opacity-50"
              >
                {videoState.isPlaying ? <Pause /> : <Play />}
              </button>
              <input 
                type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek}
                disabled={!isHost} className="flex-1 accent-purple-500 h-1"
              />
              <span className="text-xs font-mono text-gray-400">{formatTime(currentTime)} / {formatTime(duration)}</span>
              <button onClick={toggleMute} className="p-2 text-gray-400">{isMuted ? <VolumeX /> : <Volume2 />}</button>
              <button onClick={toggleFullscreen} className="p-2 text-gray-400"><Maximize /></button>
            </div>
          </div>
        )}
        
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Status</p>
            <p className="text-sm font-medium">{isHost ? '👑 Hosting' : '🍿 Watching'}</p>
          </div>
          <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Host</p>
            <p className="text-sm font-medium">{hostName || 'Unknown'}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
