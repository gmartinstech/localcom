"use client"

import { useEffect } from 'react';
import { useToast } from './ui/use-toast';

export function ServiceWorkerRegistrar() {
    const { toast } = useToast();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                }).catch(error => {
                    console.error('Service Worker registration failed:', error);
                    toast({
                        title: 'Modo Offline Indisponível',
                        description: 'Não foi possível registrar o service worker.',
                        variant: 'destructive',
                    });
                });
            });
        }
    }, [toast]);

    return null; // This component does not render anything
}
