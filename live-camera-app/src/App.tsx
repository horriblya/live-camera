import React, { useEffect, useState } from 'react';
import './App.css';

type CameraState =
  | 'loading'
  | 'ok'
  | 'camera_unavailable'
  | 'proxy_unavailable'
  | 'unauthorized'
  | 'no_config';

function App()
{
  const [status, setStatus] = useState<CameraState>('loading');

  useEffect(() =>
  {
    let mounted = true;

    setStatus('ok');

    return;

    const check = () =>
    {
      fetch('http://localhost:33001/camera/status', { cache: 'no-store' })
        .then((res) => res.json())
        .then((json) =>
        {
          if (!mounted) return;
          if (json && json.status === 'ok')
          {
            setStatus('ok');
            return;
          }

          if (json && json.status === 'error')
          {
            switch (json.reason)
            {
              case 'unauthorized':
                setStatus('unauthorized');
                break;
              case 'cannot_connect':
              case 'camera_error':
                setStatus('camera_unavailable');
                break;
              case 'no_camera_host_configured':
                setStatus('no_config');
                break;
              default:
                setStatus('camera_unavailable');
            }
            return;
          }

          setStatus('camera_unavailable');
        })
        .catch(() =>
        {
          if (!mounted) return;
          setStatus('proxy_unavailable');
        });
    };

    check();
    const id = setInterval(check, 5000);
    return () =>
    {
      mounted = false;
      clearInterval(id);
    };
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
      }}
    >
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
        style={{ width: 640, height: 480, objectFit: 'cover', background: '#000' }}
        onError={() => setStatus('camera_unavailable')}
      />
    );
  } else if (status === 'loading')
  {
    content = renderPlaceholder('Loading camera...', '📷');
  } else if (status === 'proxy_unavailable')
  {
    content = renderPlaceholder('Camera proxy is not available', '⛓️‍💥');
  } else if (status === 'unauthorized')
  {
    content = renderPlaceholder('Could not sign in to the camera server', '🔒');
  } else if (status === 'no_config')
  {
    content = renderPlaceholder('Camera host not configured', '⚙️');
  } else
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
