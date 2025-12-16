import React, { useEffect, useState } from 'react';
import './App.css';

type CameraState = 'loading' | 'ok' | 'camera_error' | 'camera_proxy_error' | 'camera_proxy_unexpected_error' | 'unauthorized' | 'no_config';

function App()
{
    const [status, setStatus] = useState<CameraState>('loading');

    useEffect(() =>
    {
        const check = async () =>
        {
            try
            {
                const res = await fetch('http://localhost:33001/camera/status', { cache: 'no-store' });

                if(res.ok)
                {
                    const json = await res.json();

                    switch (json)
                    {
                        case 'ok':
                            setStatus('ok');
                            break;
                        case 'unauthorized':
                            setStatus('unauthorized');
                            break;
                        case 'camera_error':
                            setStatus('camera_error');
                            break;
                        case 'camera_proxy_error':
                            setStatus('camera_proxy_error');
                            break;
                        case 'camera_host_not_configured':
                        case 'camera_credentials_not_configured':
                            setStatus('no_config');
                            break;
                        default:
                            setStatus('camera_proxy_unexpected_error');
                            break;
                    }
                }
                else
                {
                    setStatus('camera_proxy_unexpected_error');
                }
            }
            catch
            {
                setStatus('camera_proxy_error');
            }
        };

        check();
        const id = setInterval(check, 5000);
        return () => clearInterval(id);
    }, []);

    const renderPlaceholder = (message: string, icon: string) => (
        <div
            style={{
                width: 640,
                height: 480,
                background: '#000',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                fontFamily: 'Arial, sans-serif',
            }}>
                
            <div style={{ fontSize: 48, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 18 }}>{message}</div>
        </div>
    );

    let content: React.ReactNode = null;
    if (status === 'ok')
    {
        content = (
            <img
                src="http://localhost:33001/camera"
                alt="IP Camera"
                style={{ width: 640, height: 480, objectFit: 'contain', background: '#000' }}
                onError={() => setStatus('camera_proxy_error')}/>
        );
    } 
    else if (status === 'loading')
    {
        content = renderPlaceholder('Loading camera...', '📷');
    } 
    else if (status === 'camera_proxy_error')
    {
        content = renderPlaceholder('Camera proxy is not available', '⛓️‍💥');
    } 
    else if (status === 'camera_proxy_unexpected_error')
    {
        content = renderPlaceholder('Something went wrong', '🚀');
    } 
    else if (status === 'unauthorized')
    {
        content = renderPlaceholder('Could not sign in to the camera', '🔒');
    } 
    else if (status === 'no_config')
    {
        content = renderPlaceholder('Camera proxy is not configured', '⚙️');
    } 
    else if (status === 'camera_error')
    {
        content = renderPlaceholder('Camera is not available', '📷');
    }

    return (
        <div className="App">
            <header className="App-header">
                <div style={{ fontFamily: 'Arial, sans-serif', padding: 16 }}>
                    <h1>IP Camera Stream</h1>
                    <p>
                        Ip camera stream. The proxy should be at <code>http://localhost:33001/camera</code>
                    </p>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>{content}</div>
                </div>
            </header>
        </div>
    );
}

export default App;
