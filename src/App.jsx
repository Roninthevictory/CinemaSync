import React, { useState, useEffect, useRef } from 'react';
import { EmbeddedAppSdk } from '@discord/embedded-app-sdk';
import { io } from 'socket.io-client';
import { Play, Pause, Link, Users, Film, Clock, Loader2 } from 'lucide-react';

const socket = io(window.location.origin);

function App() {
  const [sdk, setSdk] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isHost, setIsHost] = useState(false);
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
  const videoRef = useRef(null);

  useEffect(() => {
    const initSdk = async () => {
      try {
        const embeddedSdk = new EmbeddedAppSdk({
          debug: true,
          origin: window.location.origin
        });
        
        setSdk(embeddedSdk);
        
        // Wait for SDK ready
        await embeddedSdk.ready();
        console.log('SDK Ready');
        
        // Authorize with Discord
        const { code } = await embeddedSdk.authorize();
        
        // Exchange code for token via our server
        const tokenResponse = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        
        if (!tokenResponse.ok) {
          throw new Error('Failed to authenticate with Discord');
        }
        
        const tokenData = await tokenResponse.json();
        
        // Get user info
        const userResponse = await fetch('/api/user', {
          headers: { 
            'Authorization': `Bearer ${tokenData.access_token}` 
          }
        });
        
        if (!userResponse.ok) {
          throw new Error('Failed to get user info');
        }
        
        const userData = await userResponse.json();
        setUser(userData);
        setAuthenticated(true);
        
        // Get channel info from SDK
        const channelId = embeddedSdk.channelId;
        const guildId = embeddedSdk.guildId;
        
        // Join the socket room
        socket.emit('join_channel', {
          channelId,
          guildId,
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
    
    return () => {
      if (sdk) {
        sdk.destroy();
      }
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    socket.on('role_assigned', ({ isHost }) => {
      setIsHost(isHost);
      console.log('Assigned role:', isHost ? 'Host' : 'Guest');
    });

    socket.on('video_state_update', (state) => {
      console.log('Video state update:', state);
      setVideoState(state);
      
      if (videoRef.current) {
        if (state.timestamp !== undefined) {
          videoRef.current.currentTime = state.timestamp;
        }
        if (state.isPlaying) {
          videoRef.current.play().catch(console.error);
        } else {
          videoRef.current.pause();
        }
      }
    });

    socket.on('user_joined', ({ userId, userName, isHost }) => {
      console.log(`User ${userName} joined as ${isHost ? 'Host' : 'Guest'}`);
    });

    socket.on('user_left', ({ userId }) => {
      console.log(`User ${userId} left`);
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    return () => {
      socket.off('role_assigned');
      socket.off('video_state_update');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('error');
    };
  }, []);

  // Video event handlers
  const handleVideoLoad = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlay = () => {
    if (isHost) {
      socket.emit('video_control', {
        channelId: sdk?.channelId,
        action: 'play',
        data: { timestamp: videoRef.current?.currentTime || 0 }
      });
    }
  };

  const handlePause = () => {
    if (isHost) {
      socket.emit('video_control', {
        channelId: sdk?.channelId,
        action: 'pause',
        data: { timestamp: videoRef.current?.currentTime || 0 }
      });
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
    if (isHost) {
      socket.emit('video_control', {
        channelId: sdk?.channelId,
        action: 'seek',
        data: { timestamp: time }
      });
    }
  };

  const handleSetUrl = (e) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    
    socket.emit('video_control', {
      channelId: sdk?.channelId,
      action: 'set_url',
      data: { url: videoUrl }
    });
    
    setVideoUrl('');
  };

  const requestSync = () => {
    socket.emit('video_control', {
      channelId: sdk?.channelId,
      action: 'sync'
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Initializing CinemaSync...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Film className="w-8 h-8 text-purple-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              CinemaSync
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">
                {user?.username || 'Loading...'}
              </span>
              {isHost && (
                <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
                  HOST
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        {/* Video URL Input (Host Only) */}
        {isHost && (
          <div className="mb-6">
            <form onSubmit={handleSetUrl} className="flex gap-3">
              <div className="flex-1 relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste video URL (mp4, webm, etc.)"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Load Video
              </button>
            </form>
          </div>
        )}

        {/* Video Player */}
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-4">
          {videoState.url ? (
            <video
              ref={videoRef}
              src={videoState.url}
              className="w-full h-full"
              onLoadedMetadata={handleVideoLoad}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              playsInline
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/30">
              <Film className="w-20 h-20 text-gray-600 mb-4" />
              <p className="text-gray-500 text-lg">
                {isHost ? 'Enter a video URL above to start' : 'Waiting for host to load a video...'}
              </p>
              {!isHost && (
                <button
                  onClick={requestSync}
                  className="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Request Sync
                </button>
              )}
            </div>
          )}
        </div>

        {/* Video Controls */}
        {videoState.url && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    if (videoState.isPlaying) {
                      videoRef.current.pause();
                    } else {
                      videoRef.current.play();
                    }
                  }
                }}
                disabled={!isHost}
                className={`p-3 rounded-full transition-colors ${
                  isHost 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {videoState.isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
              
              <div className="flex-1 flex items-center gap-3">
                <span className="text-sm text-gray-400 font-mono w-12">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={!isHost}
                  className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer ${
                    isHost 
                      ? 'bg-gray-700 accent-purple-500' 
                      : 'bg-gray-800 cursor-not-allowed'
                  }`}
                />
                <span className="text-sm text-gray-400 font-mono w-12">
                  {formatTime(duration)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span>
                  {videoState.isPlaying ? 'Playing' : 'Paused'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Your Role</h3>
            <p className="text-xl font-semibold text-purple-400">
              {isHost ? 'Host (Control Playback)' : 'Guest (Follow Host)'}
            </p>
          </div>
          <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Sync Status</h3>
            <p className="text-xl font-semibold text-green-400">
              {videoState.url ? 'Connected' : 'Waiting for Video'}
            </p>
          </div>
          <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Instructions</h3>
            <p className="text-sm text-gray-300">
              {isHost 
                ? 'Paste a video URL above to start playback. Your guests will automatically sync.'
                : 'Your playback is controlled by the host. Use "Request Sync" if out of sync.'
              }
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
