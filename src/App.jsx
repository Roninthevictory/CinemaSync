import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Play, Pause, Link, Users, Film, Clock, Loader2, X, Volume2, VolumeX, Maximize, Minimize, AlertCircle, Mic, MicOff, MonitorPlay } from 'lucide-react';

const socket = io(window.location.origin);

function App() {
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
  const [sdkLoadError, setSdkLoadError] = useState(false);
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

  useEffect(() => {
    const initApp = async () => {
      try {
        // Discord SDK check (must be in Discord iframe)
        if (typeof window.EmbeddedAppSdk === 'undefined') {
          console.warn('⚠️ Discord SDK not available - Demo mode (not in Discord iframe)');
          // Fallback demo mode for testing
          setSdkLoadError(true);
          setUser({ id: 'demo', username: 'DemoUser' });
          setAuthenticated(true);
          setIsLoading(false);
          showNotification('Demo mode - Open in Discord for full features', 'info');
          return;
        }

        // Load Discord SDK
        const { EmbeddedAppSdk } = await import('@discord/embedded-app-sdk');
        const sdk = new EmbeddedAppSdk({ debug: true });

        // SDK ready check
        await sdk.ready();
        console.log('✅ Discord SDK Ready');

        // Get Discord auth code
        const { code } = await sdk.authorize();
        console.log('🔑 Auth code:', code.slice(0, 10) + '...');

        // Exchange for token
        const tokenResponse = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });

        if (!tokenResponse.ok) {
          const err = await tokenResponse.text();
          throw new Error(`Token exchange failed: ${tokenResponse.status} - ${err}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Token OK');

        // Get user info
        const userResponse = await fetch('/api/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        if (!userResponse.ok) {
          throw new Error(`User fetch failed: ${userResponse.status}`);
        }

        const userData = await userResponse.json();
        console.log('👤 Logged in:', userData.username);

        setUser(userData);
        setAuthenticated(true);
        setIsLoading(false);

        // Join socket room (use Discord channelId)
        const channelId = sdk.channelId;
        const guildId = sdk.guildId;
        socket.emit('join_channel', {
          channelId,
          guildId,
          userId: userData.id,
          userName: userData.username
        });

      } catch (err) {
        console.error('💥 App init FAILED:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // Socket listeners (simplified)
  useEffect(() => {
    socket.on('role_assigned', ({ isHost, hostId, hostName, videoUrl, isPlaying, timestamp }) => {
      setIsHost(isHost);
      setHostId(hostId);
      setHostName(hostName);
      if (videoUrl) setVideoState({ url: videoUrl, isPlaying, timestamp });
      console.log(`${isHost ? '👑 HOST' : '👥 Guest'}: ${hostName}`);
    });

    socket.on('video_state_update', (state) => {
      setVideoState(state);
      console.log('📺 Video sync:', state.url ? 'Playing' : 'No video');
    });

    socket.on('error', (data) => {
      setError(data.message);
      showNotification(data.message, 'error');
    });

    return () => socket.disconnect();
  }, []);

  // Video handlers
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlay = () => isHost && socket.emit('video_control', {
    action: 'play',
    timestamp: videoRef.current?.currentTime || 0
  });

  const handlePause = () => isHost && socket.emit('video_control', {
    action: 'pause',
    timestamp: videoRef.current?.currentTime || 0
  });

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = time;
    isHost && socket.emit('video_control', { action: 'seek', timestamp: time });
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
          Initializing CinemaSync...
        </h1>
        <p className="text-gray-400">Loading Discord SDK and connecting...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="max-w-md mx-auto text-center">
        <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-white mb-4">Setup Error</h2>
        <p className="text-gray-300 mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold"
        >
          🔄 Retry
        </button>
        <p className="text-sm text-gray-500 mt-4">
          Tip: Must use in Discord Activity iframe
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black text-white">
      {notification && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-2xl backdrop-blur-sm flex items-center gap-3 text-sm font-medium ${
          notification.type === 'error' ? 'bg-red-500/90 text-white border-red-400/50' :
          notification.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/50' : 
          'bg-blue-500/90 text-white border-blue-400/50'
        } border`}>
          <AlertCircle className="w-5 h-5" />
          {notification.message}
        </div>
      )}

      <header className="backdrop-blur-sm bg-black/30 border-b border-white/10 sticky top-0 z-20 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Film className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-2xl text-white shadow-lg" />
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text">
                CinemaSync
              </h1>
              <p className="text-xs text-purple-300/70 font-medium">Discord Watch Party</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <Users className="w-4 h-4 inline mr-1" />
              {participantCount} watching
            </div>
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <span>{user?.username}</span>
              {isHost && <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full">HOST</span>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {isHost && (
          <div className="mb-8 bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSetUrl(e); }} className="flex gap-4">
              <div className="flex-1 relative">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://your-video.mp4 or YouTube/Vimeo link"
                  className="w-full bg-black/50 border border-gray-600 rounded-xl pl-12 pr-4 py-4 text-lg placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button type="submit" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-xl font-bold text-lg shadow-lg">
                ▶️ Play Movie
              </button>
            </form>
            <p className="text-gray-400 mt-2 text-sm">Direct MP4/WebM links work best for perfect sync</p>
          </div>
        )}

        {videoState.url && (
          <div className="mb-8">
            <div ref={playerRef} className="relative bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video mb-6">
              <video
                ref={videoRef}
                src={videoState.url}
                className="w-full h-full object-contain"
                onTimeUpdate={handleVideoTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
                muted={guestsMuted}
                playsInline
              />
              {guestsMuted && !isHost && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="text-center text-yellow-400">
                    <MicOff className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-lg">Audio muted by host</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => videoRef.current && (videoState.isPlaying ? videoRef.current.pause() : videoRef.current.play())}
                  disabled={!isHost}
                  className={`p-4 rounded-2xl transition-all shadow-lg ${
                    isHost 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 text-white shadow-purple-500/50' 
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {videoState.isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
                
                <div className="flex-1 flex items-center gap-4">
                  <span className="w-16 text-sm font-mono text-gray-400 min-w-[4rem]">
                    {formatTime(currentTime)}
                  </span>
                  
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={!isHost}
                    className={`flex-1 h-2 rounded-full appearance-none cursor-pointer bg-gray-700 ${
                      isHost ? 'accent-purple-500 hover:accent-purple-400 [&::-webkit-slider-thumb]:bg-purple-500' : 'cursor-not-allowed opacity-50'
                    }`}
                  />
                  
                  <span className="w-16 text-sm font-mono text-gray-400 min-w-[4rem]">
                    {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={toggleMute}
                    className="p-3 rounded-2xl hover:bg-gray-700 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  
                  <button 
                    onClick={toggleFullscreen}
                    className="p-3 rounded-2xl hover:bg-gray-700 transition-colors"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!videoState.url && (
          <div className="text-center py-20">
            <Film className="w-24 h-24 text-gray-600 mx-auto mb-8" />
            <h2 className="text-3xl font-black text-white mb-4">No Video Loaded</h2>
            <p className="text-xl text-gray-400 mb-8 max-w-md mx-auto">
              {isHost 
                ? 'Paste a direct MP4/WebM video URL above to start the watch party'
                : 'Waiting for host to load a movie. Sync starts automatically when video loads.'
              }
            </p>
            {!isHost && (
              <button 
                onClick={requestSync}
                className="bg-gray-700 hover:bg-gray-600 px-8 py-4 rounded-2xl text-lg font-semibold transition-colors"
              >
                🔄 Check Sync
              </button>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-black/30 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-300">
              <Users className="w-5 h-5" />
              Your Role
            </h3>
            <div className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
              {isHost ? '👑 Host' : '👥 Guest'}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {isHost ? 'You control playback and mute' : 'Follow host playback automatically'}
            </p>
          </div>

          <div className="bg-black/30 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-300">
              <Clock className="w-5 h-5" />
              Status
            </h3>
            <div className={`text-2xl font-black px-4 py-2 rounded-xl ${
              videoState.url ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            } border`}>
              {videoState.url ? 'Synced' : 'Waiting...'}
            </div>
          </div>

          <div className="bg-black/30 backdrop-blur border border-white/10 rounded-2xl p-6 md:col-span-1">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-300">
              ℹ️ Instructions
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {isHost 
                ? '• Load video → Guests auto-sync<br>• Use mute for movie nights<br>• End session when done'
                : '• Auto-syncs to host<br>• Request sync if laggy<br>• Respect host mute requests'
              }
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

