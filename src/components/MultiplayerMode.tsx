import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Users, Code, SplitSquareHorizontal, User, RefreshCw } from 'lucide-react';

export function MultiplayerMode({ onRunDiff }: { onRunDiff: (textA: string, textB: string) => void }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('User' + Math.floor(Math.random() * 1000));
  const [inRoom, setInRoom] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [myText, setMyText] = useState('');
  
  const [selectedForDiff, setSelectedForDiff] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
    };
  }, [socket]);

  const joinRoom = () => {
    if (!roomId) return;
    const newSocket = io();
    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId, username });
    });
    
    newSocket.on('room-update', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    setSocket(newSocket);
    setInRoom(true);
  };

  const handleTextChange = (e: any) => {
    const text = e.target.value;
    setMyText(text);
    if (socket) {
      socket.emit('update-text', text);
    }
  };

  const toggleSelectForDiff = (id: string) => {
    if (selectedForDiff.includes(id)) {
      setSelectedForDiff(selectedForDiff.filter(x => x !== id));
    } else {
      if (selectedForDiff.length >= 2) {
        setSelectedForDiff([selectedForDiff[1], id]); // Keep last two
      } else {
        setSelectedForDiff([...selectedForDiff, id]);
      }
    }
  };

  const handleRunDiff = () => {
    if (selectedForDiff.length !== 2) return;
    const userA = users.find(u => u.id === selectedForDiff[0]);
    const userB = users.find(u => u.id === selectedForDiff[1]);
    if (userA && userB) {
      onRunDiff(userA.text, userB.text);
    }
  };

  if (!inRoom) {
    return (
      <div className="bg-[#020617] border border-[#334155] p-8 rounded-xl flex flex-col gap-6 max-w-md mx-auto shadow-2xl animate-in zoom-in-95 mt-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#1E293B] rounded-full flex items-center justify-center border border-[#334155] text-[#34D399]">
            <Users className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center text-white">Live Multiplayer Collab</h2>
        <p className="text-sm text-[#94A3B8] text-center">
          Join a room with up to 16 colleagues. Everyone gets their own code editor. 
          Select any two teammates to run a diff instantly.
        </p>
        <div className="flex flex-col gap-4 font-mono text-xs">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#0F172A] border border-[#334155] rounded px-4 py-3 text-white focus:border-[#34D399] outline-none"
          />
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full bg-[#0F172A] border border-[#334155] rounded px-4 py-3 text-white focus:border-[#34D399] outline-none"
          />
          <button onClick={joinRoom} disabled={!roomId} className="w-full py-3 bg-[#34D399] text-[#064E3B] font-bold rounded hover:bg-[#10B981] transition-colors disabled:opacity-50">
            JOIN ROOM
          </button>
        </div>
      </div>
    );
  }

  // Calculate grid columns based on number of users (up to 16)
  const getGridCols = () => {
    const len = users.length;
    if (len <= 1) return 'grid-cols-1';
    if (len <= 4) return 'grid-cols-1 md:grid-cols-2';
    if (len <= 9) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-4';
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#020617] border border-[#334155] rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-[#0F172A] p-4 border-b border-[#334155] rounded-t-xl">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#60A5FA]" />
          <h3 className="font-bold text-white tracking-widest text-sm uppercase">Room: {roomId}</h3>
          <span className="text-xs bg-[#1E293B] text-[#94A3B8] px-2 py-1 rounded font-mono">{users.length} / 16 players</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#94A3B8] font-mono">
            {selectedForDiff.length === 0 ? 'Select 2 players to diff' : selectedForDiff.length === 1 ? 'Select 1 more' : 'Ready to diff!'}
          </span>
          <button 
            onClick={handleRunDiff} 
            disabled={selectedForDiff.length !== 2}
            className="px-4 py-1.5 bg-[#34D399] text-[#064E3B] font-bold rounded hover:bg-[#10B981] transition-colors disabled:opacity-50 text-xs flex items-center gap-2"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" /> RUN DIFF
          </button>
        </div>
      </div>
      
      <div className={`flex-1 p-4 overflow-y-auto grid gap-4 ${getGridCols()}`}>
        {users.map(u => {
          const isMe = u.id === socket?.id;
          const isSelected = selectedForDiff.includes(u.id);
          const selectionIndex = selectedForDiff.indexOf(u.id);
          
          return (
            <div 
              key={u.id} 
              className={`flex flex-col border rounded-xl overflow-hidden transition-all ${isSelected ? (selectionIndex === 0 ? 'border-[#34D399] shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'border-[#F472B6] shadow-[0_0_15px_rgba(244,114,182,0.3)]') : 'border-[#334155]'}`}
            >
              <div className="bg-[#1E293B] p-2 flex justify-between items-center border-b border-[#334155]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: u.color }} />
                  <span className="text-xs font-bold text-white">{u.username} {isMe && '(You)'}</span>
                </div>
                <button 
                  onClick={() => toggleSelectForDiff(u.id)}
                  className={`text-[10px] px-2 py-1 rounded font-mono ${isSelected ? (selectionIndex === 0 ? 'bg-[#064E3B] text-[#34D399]' : 'bg-[#831843] text-[#F472B6]') : 'bg-[#0F172A] text-[#94A3B8] hover:text-white'}`}
                >
                  {isSelected ? `SELECTED ${selectionIndex === 0 ? 'A' : 'B'}` : 'SELECT'}
                </button>
              </div>
              {isMe ? (
                <textarea
                  value={myText}
                  onChange={handleTextChange}
                  placeholder="Start typing..."
                  className="flex-1 min-h-[150px] bg-[#0A0A0C] text-[#E2E8F0] p-3 text-xs font-mono outline-none resize-none"
                />
              ) : (
                <div className="flex-1 min-h-[150px] bg-[#0A0A0C] text-[#E2E8F0] p-3 text-xs font-mono overflow-y-auto whitespace-pre-wrap opacity-80 pointer-events-none">
                  {u.text || <span className="text-[#64748B] italic">Waiting for input...</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
