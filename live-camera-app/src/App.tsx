import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div style={{ fontFamily: 'Arial, sans-serif', padding: 16 }}>
          <h1>IP Camera Stream</h1>
          <p>Ip camera stream. The proxy should be at <code>http://localhost:3001/camera</code></p>
          <div style={{ marginTop: 8 }}>
            <img
              src="http://localhost:3001/camera"
              alt="IP Camera"
              style={{ width: '640px', height: '480px', background: '#000' }}
            />
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
