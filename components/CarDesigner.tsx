import React, { useRef, useState, useEffect } from 'react';
import { CarDesign } from '../types';

interface CarDesignerProps {
  initialDesign?: CarDesign;
  onSave: (design: CarDesign) => void;
  onCancel: () => void;
}

const CarDesigner: React.FC<CarDesignerProps> = ({ initialDesign, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#00f0ff');
  const [brushSize, setBrushSize] = useState(5);
  const [brushShape, setBrushShape] = useState<'round' | 'square'>('round');
  const [mode, setMode] = useState<'DRAW' | 'WHEEL'>('DRAW');
  const [isEraser, setIsEraser] = useState(false);
  const [wheels, setWheels] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize Canvas & Load Existing Design
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set resolution higher for crisp lines, but display size is controlled by CSS
      canvas.width = 800;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (initialDesign) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = initialDesign.imageData;
            setWheels(initialDesign.wheelPositions);
        }
      }
    }
  }, []); // Run once on mount

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'WHEEL') return handleWheelPlacement(e);
    
    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.lineCap = brushShape;
      ctx.lineJoin = brushShape === 'round' ? 'round' : 'bevel';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize * 2; // Scale brush for high-res canvas
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode !== 'DRAW') return;
    
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.closePath();
      setIsDrawing(false);
      // Reset composite operation to avoid affecting other render logic immediately
      if (ctx) ctx.globalCompositeOperation = 'source-over';
    }
  };

  const handleWheelPlacement = (e: React.MouseEvent | React.TouchEvent) => {
    // Only add if we have < 2 wheels. To move, user must clear for now.
    if (wheels.length >= 2) return; 
    
    const { x, y } = getPos(e);
    const canvas = canvasRef.current;
    if(canvas) {
        setWheels([...wheels, { 
            x: (x / canvas.width) * 100, 
            y: (y / canvas.height) * 100 
        }]);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setWheels([]);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas && wheels.length === 2) {
      onSave({
        imageData: canvas.toDataURL(),
        wheelPositions: wheels.sort((a, b) => a.x - b.x)
      });
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center overflow-y-auto p-4 md:justify-center animate-fade-in touch-pan-y">
      <h2 className="text-3xl md:text-5xl font-black text-white italic mb-6 text-center tracking-tighter shrink-0">
        <span className="text-cyan-400">CUSTOM</span> SHOP
      </h2>
      
      {/* Main Toolbar */}
      <div className="w-full max-w-2xl bg-slate-800/80 p-4 rounded-xl border border-slate-700 backdrop-blur-md mb-6 shadow-xl shrink-0">
        
        {/* Row 1: Primary Modes */}
        <div className="flex gap-2 mb-4">
            <button 
                onClick={() => setMode('DRAW')}
                className={`flex-1 py-3 rounded font-bold uppercase tracking-wider text-sm transition-all ${mode === 'DRAW' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-slate-700 text-gray-400'}`}
            >
                🖌️ Paint Body
            </button>
            <button 
                onClick={() => setMode('WHEEL')}
                className={`flex-1 py-3 rounded font-bold uppercase tracking-wider text-sm transition-all ${mode === 'WHEEL' ? 'bg-yellow-600 text-white shadow-lg' : 'bg-slate-700 text-gray-400'}`}
            >
                ◎ Add Axles ({wheels.length}/2)
            </button>
        </div>

        {/* Row 2: Drawing Tools (Only visible in Draw Mode) */}
        {mode === 'DRAW' && (
            <div className="flex flex-col gap-3 bg-slate-900/50 p-3 rounded-lg">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    {/* Color & Eraser Group */}
                    <div className="flex gap-3 items-center">
                        <input 
                            type="color" 
                            value={color} 
                            onChange={(e) => { setColor(e.target.value); setIsEraser(false); }}
                            className="w-10 h-10 rounded border-2 border-slate-500 cursor-pointer bg-transparent"
                        />
                        <button 
                            onClick={() => setIsEraser(!isEraser)}
                            className={`w-10 h-10 rounded flex items-center justify-center border-2 font-bold text-xl ${isEraser ? 'bg-white text-black border-white' : 'bg-slate-700 text-gray-400 border-slate-600'}`}
                            title="Eraser"
                        >
                            ⌫
                        </button>
                    </div>

                    {/* Brush Shape */}
                    <div className="flex gap-1 bg-slate-800 p-1 rounded border border-slate-600">
                        <button
                            onClick={() => setBrushShape('round')}
                            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${brushShape === 'round' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Round Brush"
                        >
                            <div className="w-3 h-3 bg-current rounded-full"></div>
                        </button>
                        <button
                            onClick={() => setBrushShape('square')}
                            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${brushShape === 'square' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Square Brush"
                        >
                            <div className="w-3 h-3 bg-current"></div>
                        </button>
                    </div>

                    {/* Clear */}
                    <button 
                        onClick={clearCanvas} 
                        className="px-3 py-2 bg-red-900/30 text-red-400 border border-red-900 rounded hover:bg-red-900 hover:text-white text-xs font-bold uppercase"
                    >
                        Clear
                    </button>
                </div>

                {/* Size Slider */}
                <div className="flex flex-col w-full">
                    <div className="flex justify-between mb-1">
                         <label className="text-[10px] text-gray-400 uppercase tracking-widest">Brush Size</label>
                         <span className="text-[10px] text-gray-400 font-mono">{brushSize}px</span>
                    </div>
                    <input 
                        type="range" 
                        min="2" max="50" 
                        value={brushSize} 
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                    />
                </div>
            </div>
        )}

        {mode === 'WHEEL' && (
             <div className="text-center p-3 bg-yellow-900/20 rounded-lg border border-yellow-900/50 text-yellow-200 text-sm">
                 {wheels.length === 0 ? "Tap chassis to place Rear Axle" : wheels.length === 1 ? "Tap chassis to place Front Axle" : "Axles placed! Switch to Paint or Save."}
                 {wheels.length > 0 && (
                     <button onClick={() => setWheels([])} className="ml-4 underline text-yellow-500 hover:text-yellow-400">Reset Wheels</button>
                 )}
             </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="relative w-full max-w-2xl border-4 border-slate-600 bg-slate-800 rounded-lg overflow-hidden shadow-2xl mb-6 touch-none shrink-0 group">
        
        {/* Background Grid for precision feeling */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full h-auto block touch-none ${mode === 'DRAW' ? (isEraser ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-pointer'}`}
          style={{ aspectRatio: '800/300' }}
        />
        
        {/* Render Wheel Previews */}
        {wheels.map((w, i) => (
            <div 
                key={i}
                className="absolute w-12 h-12 rounded-full border-4 border-yellow-400 bg-black/40 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                style={{ left: `${w.x}%`, top: `${w.y}%` }}
            >
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                <span className="absolute -top-6 text-[10px] font-black bg-yellow-400 text-black px-1 rounded">{i === 0 ? 'REAR' : 'FRONT'}</span>
            </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4 w-full max-w-2xl shrink-0 pb-6">
        <button 
            onClick={onCancel}
            className="flex-1 py-4 bg-slate-700 text-white font-bold rounded uppercase tracking-wider hover:bg-slate-600 transition-colors"
        >
            Cancel
        </button>
        <button 
            onClick={handleSave}
            disabled={wheels.length !== 2}
            className={`flex-1 py-4 font-bold rounded uppercase tracking-wider transition-all flex items-center justify-center gap-2
                ${wheels.length === 2 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_0_20px_#10b981] hover:scale-105' 
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
        >
            {wheels.length !== 2 ? (
                <><span>⚠️</span> <span>Place {2 - wheels.length} More Axles</span></>
            ) : (
                <><span>🚀</span> <span>Build & Race</span></>
            )}
        </button>
      </div>
    </div>
  );
};

export default CarDesigner;
