import React, { useState, useEffect, useMemo } from 'react';
import { 
  Warehouse, 
  Package, 
  Truck, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Clock, 
  MapPin, 
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Play,
  Settings,
  FileJson,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeWarehouseOperations } from './services/geminiService';
import { WarehouseInput, WarehouseAnalysis, WarehouseLayout } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_INPUT: WarehouseInput = {
  layout: {
    zones: [
      { id: 'Z1', name: 'Ambient North', type: 'ambient', capacity: 100, dispatch_proximity: 8 },
      { id: 'Z2', name: 'Ambient South', type: 'ambient', capacity: 100, dispatch_proximity: 4 },
      { id: 'Z3', name: 'Cold Storage', type: 'cold', capacity: 50, dispatch_proximity: 6 },
      { id: 'Z4', name: 'Hazmat Vault', type: 'hazmat', capacity: 20, dispatch_proximity: 2 },
    ],
    aisles: [
      { id: 'A1', zone_id: 'Z1', coordinate_x: 10 },
      { id: 'A2', zone_id: 'Z1', coordinate_x: 20 },
      { id: 'A3', zone_id: 'Z2', coordinate_x: 10 },
      { id: 'A4', zone_id: 'Z3', coordinate_x: 5 },
    ],
    bins: [
      { id: 'B1-1', aisle_id: 'A1', coordinate_y: 5, max_weight: 50 },
      { id: 'B1-2', aisle_id: 'A1', coordinate_y: 10, max_weight: 50 },
      { id: 'B2-1', aisle_id: 'A2', coordinate_y: 5, max_weight: 50 },
      { id: 'B3-1', aisle_id: 'A3', coordinate_y: 5, max_weight: 50 },
      { id: 'B4-1', aisle_id: 'A4', coordinate_y: 5, max_weight: 20 },
    ]
  },
  inventory: [
    { sku: 'SKU-001', name: 'Widget A', bin_id: 'B3-1', quantity: 500, weight_per_unit: 0.5, is_hazmat: false, temperature_req: 'ambient' },
    { sku: 'SKU-002', name: 'Frozen Item B', bin_id: 'B4-1', quantity: 100, weight_per_unit: 1.2, is_hazmat: false, temperature_req: 'cold' },
    { sku: 'SKU-003', name: 'Chemical C', bin_id: 'B1-1', quantity: 50, weight_per_unit: 5.0, is_hazmat: true, temperature_req: 'ambient' },
    { sku: 'SKU-004', name: 'Fast Mover D', bin_id: 'B2-1', quantity: 1000, weight_per_unit: 0.1, is_hazmat: false, temperature_req: 'ambient' },
  ],
  orders: [
    { id: 'ORD-101', priority: 'express', items: [{ sku: 'SKU-004', quantity: 5 }, { sku: 'SKU-001', quantity: 2 }], timestamp: '2024-03-15T10:00:00Z' },
    { id: 'ORD-102', priority: 'standard', items: [{ sku: 'SKU-002', quantity: 10 }], timestamp: '2024-03-15T10:05:00Z' },
    { id: 'ORD-103', priority: 'same-day', items: [{ sku: 'SKU-003', quantity: 1 }], timestamp: '2024-03-15T10:10:00Z' },
  ],
  active_pickers: 2,
  throughput_target: 30
};

const WarehouseMap = ({ layout, analysis }: { layout: WarehouseLayout, analysis: WarehouseAnalysis }) => {
  const binCoords = useMemo(() => {
    const coords: Record<string, { x: number, y: number }> = {};
    layout.bins.forEach(bin => {
      const aisle = layout.aisles.find(a => a.id === bin.aisle_id);
      if (aisle) {
        coords[bin.id] = { x: aisle.coordinate_x * 10, y: bin.coordinate_y * 10 };
      }
    });
    return coords;
  }, [layout]);

  const colors = ['#141414', '#EF4444', '#3B82F6', '#10B981', '#F59E0B'];

  return (
    <div className="relative w-full aspect-[16/9] bg-white rounded-2xl border border-[#141414]/10 shadow-sm overflow-hidden p-8 mb-8">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <Navigation size={16} className="text-[#141414]/50" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Live Pick Routes</span>
      </div>

      <svg className="w-full h-full" viewBox="0 0 600 300">
        {/* Draw Aisles */}
        {layout.aisles.map(aisle => (
          <line 
            key={aisle.id}
            x1={aisle.coordinate_x * 10} 
            y1={20} 
            x2={aisle.coordinate_x * 10} 
            y2={280} 
            stroke="#14141408" 
            strokeWidth="20" 
            strokeLinecap="round"
          />
        ))}

        {/* Draw Bins */}
        {layout.bins.map(bin => {
          const coord = binCoords[bin.id];
          if (!coord) return null;
          return (
            <g key={bin.id}>
              <rect 
                x={coord.x - 6} 
                y={coord.y - 6} 
                width={12} 
                height={12} 
                rx={2}
                fill="white"
                stroke="#14141420"
                strokeWidth="1"
              />
              <text 
                x={coord.x} 
                y={coord.y + 15} 
                textAnchor="middle" 
                fontSize="6" 
                fontWeight="bold" 
                fill="#14141440"
              >
                {bin.id}
              </text>
            </g>
          );
        })}

        {/* Draw Pick Routes */}
        {analysis.pick_routes.map((route, routeIdx) => {
          const color = colors[routeIdx % colors.length];
          const points = route.sequence
            .map(stop => binCoords[stop.bin_id])
            .filter(Boolean);

          if (points.length < 1) return null;

          return (
            <g key={route.picker_id}>
              {/* Route Line */}
              {points.length > 1 && (
                <polyline 
                  points={points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
              )}

              {/* Stops */}
              {points.map((p, stopIdx) => (
                <g key={stopIdx}>
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={4} 
                    fill={color} 
                  />
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={8} 
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                    opacity="0.2"
                  >
                    <animate attributeName="r" from="4" to="12" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text 
                    x={p.x} 
                    y={p.y - 8} 
                    textAnchor="middle" 
                    fontSize="8" 
                    fontWeight="900" 
                    fill={color}
                  >
                    {stopIdx + 1}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex flex-wrap gap-4 bg-white/80 backdrop-blur p-3 rounded-xl border border-[#141414]/5">
        {analysis.pick_routes.map((route, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Picker {route.picker_id}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [inputJson, setInputJson] = useState(JSON.stringify(DEFAULT_INPUT, null, 2));
  const [analysis, setAnalysis] = useState<WarehouseAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const currentLayout = useMemo(() => {
    try {
      return (JSON.parse(inputJson) as WarehouseInput).layout;
    } catch {
      return DEFAULT_INPUT.layout;
    }
  }, [inputJson]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const parsedInput = JSON.parse(inputJson) as WarehouseInput;
      const result = await analyzeWarehouseOperations(parsedInput);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze warehouse data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#F5F5F0]">
      {/* Header */}
      <header className="border-b border-[#141414]/10 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-[#F5F5F0]">
              <Warehouse size={24} />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-lg">WH-OPS <span className="text-[#141414]/50 italic serif font-normal">AI</span></h1>
              <p className="text-[10px] uppercase tracking-widest font-semibold opacity-50">Fulfillment Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 hover:bg-[#141414]/5 rounded-lg transition-colors"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={handleAnalyze}
              disabled={loading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#F5F5F0] rounded-xl font-medium transition-all active:scale-95",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#F5F5F0]/30 border-t-[#F5F5F0] rounded-full animate-spin" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Config Panel */}
        <AnimatePresence>
          {showConfig && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-white rounded-2xl border border-[#141414]/10 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileJson size={18} className="text-[#141414]/50" />
                    <h2 className="font-semibold">Warehouse Input Data (JSON)</h2>
                  </div>
                  <button 
                    onClick={() => setInputJson(JSON.stringify(DEFAULT_INPUT, null, 2))}
                    className="text-xs font-medium text-[#141414]/50 hover:text-[#141414]"
                  >
                    Reset to Default
                  </button>
                </div>
                <textarea 
                  value={inputJson}
                  onChange={(e) => setInputJson(e.target.value)}
                  className="w-full h-64 bg-[#F5F5F0] rounded-xl p-4 font-mono text-xs border-none focus:ring-2 focus:ring-[#141414]/10 resize-none"
                  spellCheck={false}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <p className="font-semibold text-sm">Analysis Error</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-6 border border-[#141414]/5">
              <TrendingUp size={40} className="text-[#141414]/20" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Ready for Optimization</h2>
            <p className="text-[#141414]/50 max-w-md">
              Load your warehouse layout and order backlog to generate optimized pick paths and slotting recommendations.
            </p>
          </div>
        )}

        {analysis && (
          <div className="space-y-8">
            {/* Map Visualization */}
            <WarehouseMap layout={currentLayout} analysis={analysis} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Stats & Alerts */}
            <div className="space-y-8">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-sm">
                  <div className="flex items-center gap-2 text-[#141414]/50 mb-2">
                    <Clock size={16} />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Est. Completion</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {analysis.estimated_completion_minutes}
                    <span className="text-sm font-normal text-[#141414]/50 ml-1">min</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-sm">
                  <div className="flex items-center gap-2 text-[#141414]/50 mb-2">
                    <Users size={16} />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Pickers</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {JSON.parse(inputJson).active_pickers}
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {analysis.alerts.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#141414]/10 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#141414]/5 flex items-center justify-between bg-red-50/50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-500" />
                      <h3 className="font-bold text-sm">Operational Alerts</h3>
                    </div>
                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {analysis.alerts.length}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    {analysis.alerts.map((alert, i) => (
                      <div key={i} className="flex gap-3 text-xs p-3 rounded-xl bg-red-50/30 border border-red-100">
                        <div className="w-1 h-1 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <p className="text-red-900/80">{alert}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capacity Flags */}
              <div className="bg-white rounded-2xl border border-[#141414]/10 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#141414]/5">
                  <h3 className="font-bold text-sm">Zone Utilization</h3>
                </div>
                <div className="p-6">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analysis.capacity_flags} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#14141410" />
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis 
                          dataKey="zone_id" 
                          type="category" 
                          width={40} 
                          tick={{ fontSize: 10, fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          cursor={{ fill: '#14141405' }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #14141410', fontSize: '12px' }}
                        />
                        <Bar dataKey="utilization_percent" radius={[0, 4, 4, 0]}>
                          {analysis.capacity_flags.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.utilization_percent > 85 ? '#EF4444' : '#141414'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {analysis.capacity_flags.some(f => f.utilization_percent > 85) && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 leading-relaxed">
                        Critical capacity reached in some zones. Consider immediate replenishment or overflow routing.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Staffing Recommendation */}
              {analysis.staffing_recommendation && (
                <div className="bg-[#141414] text-[#F5F5F0] p-6 rounded-2xl shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={18} className="text-[#F5F5F0]/50" />
                    <h3 className="font-bold text-sm">Staffing Recommendation</h3>
                  </div>
                  <p className="text-xs leading-relaxed opacity-80 italic serif">
                    "{analysis.staffing_recommendation}"
                  </p>
                </div>
              )}
            </div>

            {/* Middle & Right Column: Pick Routes & Slot Changes */}
            <div className="lg:col-span-2 space-y-8">
              {/* Pick Routes */}
              <div className="bg-white rounded-2xl border border-[#141414]/10 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#141414]/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-[#141414]/50" />
                    <h3 className="font-bold text-sm">Optimized Pick Routes</h3>
                  </div>
                  <div className="flex gap-1">
                    {analysis.pick_routes.map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-[#141414]/10" />
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {analysis.pick_routes.map((route, i) => (
                      <div key={i} className="relative">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-full bg-[#141414]/5 flex items-center justify-center text-[10px] font-bold">
                            P{i + 1}
                          </div>
                          <div>
                            <p className="text-xs font-bold">Picker {route.picker_id}</p>
                            <p className="text-[10px] text-[#141414]/50 uppercase tracking-wider">{route.sequence.length} Stops</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
                          {route.sequence.map((stop, j) => (
                            <React.Fragment key={j}>
                              <div className="shrink-0 w-32 bg-[#F5F5F0] p-3 rounded-xl border border-[#141414]/5">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[9px] font-bold bg-[#141414] text-[#F5F5F0] px-1.5 py-0.5 rounded">
                                    {stop.bin_id}
                                  </span>
                                  <span className="text-[9px] text-[#141414]/50 font-mono">#{stop.order_id.split('-')[1]}</span>
                                </div>
                                <p className="text-[10px] font-bold truncate mb-1">{stop.sku}</p>
                                <p className="text-[9px] text-[#141414]/50">Qty: {stop.quantity}</p>
                              </div>
                              {j < route.sequence.length - 1 && (
                                <ChevronRight size={14} className="shrink-0 text-[#141414]/20" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Slot Changes */}
              <div className="bg-white rounded-2xl border border-[#141414]/10 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#141414]/5">
                  <div className="flex items-center gap-2">
                    <Package size={18} className="text-[#141414]/50" />
                    <h3 className="font-bold text-sm">Slotting Recommendations (ABC Analysis)</h3>
                  </div>
                </div>
                <div className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F5F5F0]/50">
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-[#141414]/50">SKU</th>
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-[#141414]/50">Current</th>
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-[#141414]/50">Target</th>
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-[#141414]/50">Justification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141414]/5">
                      {analysis.slot_changes.map((change, i) => (
                        <tr key={i} className="hover:bg-[#141414]/[0.02] transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold">{change.sku}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-mono opacity-50">{change.current_bin}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <ArrowRight size={12} className="text-[#141414]/30" />
                              <span className="text-[10px] font-bold text-emerald-600">{change.recommended_bin}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[10px] leading-relaxed italic serif text-[#141414]/60">
                              {change.justification}
                            </p>
                          </td>
                        </tr>
                      ))}
                      {analysis.slot_changes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-xs text-[#141414]/30 italic">
                            No slotting changes recommended for current inventory velocity.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-[#141414]/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-30">
            <Warehouse size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Warehouse Ops AI v1.0</span>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#141414]/30 mb-1">System Status</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold">Operational</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#141414]/30 mb-1">Last Analysis</p>
              <span className="text-[10px] font-bold">{analysis ? new Date().toLocaleTimeString() : 'N/A'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
