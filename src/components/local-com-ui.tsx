"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Send, Wifi, WifiOff, MessageSquare, Headset } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { initDB, addMessage, getMessages } from '@/lib/indexedDB';

type Message = {
  id: number;
  text: string;
  sender: 'me' | 'peer';
  timestamp: string;
};

export function LocalComUI() {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'in-call'>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [textMessage, setTextMessage] = useState('');

  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const initializeWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
    };

    ws.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('Received signaling message:', message);

      if (message.offer) {
        if (pc.current) {
          console.warn('Existing peer connection. Ignoring offer.');
          return;
        }
        await handleOffer(message.offer);
      } else if (message.answer) {
        await pc.current?.setRemoteDescription(new RTCSessionDescription(message.answer));
      } else if (message.candidate) {
        try {
          await pc.current?.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      handleEndCall();
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({ title: 'Erro de Conexão', description: 'Não foi possível conectar ao servidor de sinalização.', variant: 'destructive' });
      setConnectionStatus('disconnected');
    };
  }, [toast]);
  
  const setupPeerConnection = useCallback(() => {
      pc.current = new RTCPeerConnection();

      pc.current.onicecandidate = (event) => {
        if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ candidate: event.candidate }));
        }
      };

      pc.current.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          setCallStatus('in-call');
        }
      };

      pc.current.ondatachannel = (event) => {
          setupDataChannel(event.channel);
      };
      
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => {
          pc.current?.addTrack(track, localStream.current!);
        });
      }
  }, []);

  const setupDataChannel = (channel: RTCDataChannel) => {
    dataChannel.current = channel;
    dataChannel.current.onopen = () => console.log('Data channel open');
    dataChannel.current.onmessage = (event) => {
      const receivedMessage = {
        id: Date.now(),
        text: event.data,
        sender: 'peer' as const,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, receivedMessage]);
      addMessage(receivedMessage);
    };
    dataChannel.current.onclose = () => console.log('Data channel closed');
  };

  useEffect(() => {
    initDB().then(async () => {
      const storedMessages = await getMessages();
      setMessages(storedMessages);
    });
    initializeWebSocket();

    return () => {
      ws.current?.close();
      handleEndCall();
    };
  }, [initializeWebSocket]);
  
  const handleStartCall = async () => {
    if (callStatus !== 'idle') return;
    setCallStatus('calling');
    
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
        console.error('Error accessing media devices.', error);
        toast({ title: 'Erro de Microfone', description: 'Não foi possível acessar o microfone. Verifique as permissões.', variant: 'destructive'});
        setCallStatus('idle');
        return;
    }

    setupPeerConnection();
    const channel = pc.current!.createDataChannel("chat");
    setupDataChannel(channel);

    const offer = await pc.current!.createOffer();
    await pc.current!.setLocalDescription(offer);
    ws.current?.send(JSON.stringify({ offer }));
  };

  const handleEndCall = () => {
    pc.current?.close();
    pc.current = null;
    localStream.current?.getTracks().forEach(track => track.stop());
    localStream.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setCallStatus('idle');
  };
  
  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    setCallStatus('calling');
    setupPeerConnection();
    await pc.current!.setRemoteDescription(new RTCSessionDescription(offer));
    
    try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStream.current.getTracks().forEach(track => pc.current!.addTrack(track, localStream.current!));
    } catch (error) {
        console.error("Failed to get local stream:", error);
        toast({ title: "Erro de Microfone", description: "Não foi possível iniciar a chamada.", variant: "destructive" });
        return;
    }
    
    const answer = await pc.current!.createAnswer();
    await pc.current!.setLocalDescription(answer);
    ws.current?.send(JSON.stringify({ answer }));
  };

  const handleSendMessage = () => {
    if (textMessage.trim() && dataChannel.current?.readyState === 'open') {
      const messageToSend = {
        id: Date.now(),
        text: textMessage,
        sender: 'me' as const,
        timestamp: new Date().toLocaleTimeString(),
      };
      dataChannel.current.send(textMessage);
      setMessages((prev) => [...prev, messageToSend]);
      addMessage(messageToSend);
      setTextMessage('');
    } else {
        toast({ title: 'Chat não disponível', description: 'O canal de texto não está aberto. Inicie uma chamada.', variant: 'destructive'});
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-body p-4 md:p-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-headline text-primary-foreground">LocalCom</h1>
        <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'} className={`transition-all duration-300 ${connectionStatus === 'connected' ? 'bg-accent text-accent-foreground' : ''}`}>
          {connectionStatus === 'connected' ? <Wifi className="mr-2 h-4 w-4" /> : <WifiOff className="mr-2 h-4 w-4" />}
          {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
        </Badge>
      </header>
      
      <div className="grid md:grid-cols-2 gap-8 flex-1 min-h-0">
        {/* Call Control Card */}
        <Card className="flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Headset className="mr-3 text-primary"/> Controles da Chamada</CardTitle>
            <CardDescription>Inicie ou encerre uma chamada de voz P2P</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 gap-4">
            <div className="flex space-x-4">
              <Button size="lg" onClick={handleStartCall} disabled={callStatus !== 'idle' || connectionStatus !== 'connected'} className="w-40">
                <Phone className="mr-2 h-5 w-5" /> Iniciar Chamada
              </Button>
              <Button size="lg" onClick={handleEndCall} disabled={callStatus === 'idle'} variant="destructive" className="w-40">
                <PhoneOff className="mr-2 h-5 w-5" /> Encerrar
              </Button>
            </div>
            <div className="mt-4 text-center p-4 rounded-lg bg-muted w-full">
                <p className="font-semibold text-muted-foreground">Status da Chamada:</p>
                <p className="text-xl font-bold text-primary transition-all duration-300">
                    {callStatus === 'idle' && 'Inativa'}
                    {callStatus === 'calling' && 'Chamando...'}
                    {callStatus === 'in-call' && 'Em chamada'}
                </p>
            </div>
            <audio ref={remoteAudioRef} autoPlay playsInline controls={false} className="hidden" />
          </CardContent>
        </Card>

        {/* Chat Card */}
        <Card className="flex flex-col shadow-lg min-h-0">
          <CardHeader>
            <CardTitle className="flex items-center"><MessageSquare className="mr-3 text-primary" /> Mensagens P2P</CardTitle>
            <CardDescription>Troque mensagens de texto em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 border rounded-lg p-4 mb-4 bg-muted/50">
              <div className="space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">Nenhuma mensagem ainda.</div>
                ) : (
                    messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                        <div className={`rounded-lg px-3 py-2 max-w-xs md:max-w-md break-words ${msg.sender === 'me' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {msg.text}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">{msg.timestamp}</span>
                    </div>
                    ))
                )}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Escreva uma mensagem..."
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={dataChannel.current?.readyState !== 'open'}
              />
              <Button onClick={handleSendMessage} disabled={dataChannel.current?.readyState !== 'open'}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
