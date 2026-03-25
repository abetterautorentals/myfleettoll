import React from 'react';
import { motion } from 'framer-motion';

const statusConfig = {
  available: { label: 'Available', bg: 'bg-emerald-500', dot: 'bg-emerald-400' },
  rented:    { label: 'Rented',    bg: 'bg-blue-500',    dot: 'bg-blue-400' },
  overdue:   { label: 'Overdue',   bg: 'bg-red-500',     dot: 'bg-red-400' },
  maintenance: { label: 'Service', bg: 'bg-amber-500',   dot: 'bg-amber-400' },
};

// Minimal SVG silhouettes by vehicle type
function CarSilhouette({ type = 'sedan', color = '#6366f1' }) {
  const paths = {
    sedan: "M8,20 L8,16 C8,14 10,12 14,11 L18,10 C21,9 25,9 28,10 L32,11 C36,12 38,14 38,16 L38,20 Z M10,20 L10,18 L36,18 L36,20 Z M12,21 A2.5,2.5 0 1,0 17,21 A2.5,2.5 0 1,0 12,21 Z M29,21 A2.5,2.5 0 1,0 34,21 A2.5,2.5 0 1,0 29,21 Z",
    suv:   "M7,20 L7,15 C7,13 9,11 13,10.5 L17,10 C20,9.5 26,9.5 29,10 L33,10.5 C37,11 39,13 39,15 L39,20 Z M9,20 L9,17 L37,17 L37,20 Z M11,21 A2.5,2.5 0 1,0 16,21 A2.5,2.5 0 1,0 11,21 Z M30,21 A2.5,2.5 0 1,0 35,21 A2.5,2.5 0 1,0 30,21 Z",
    truck: "M6,20 L6,15 L22,15 L22,11 C22,10 23,10 24,10 L36,10 C38,10 40,12 40,14 L40,20 Z M8,20 L8,17 L38,17 L38,20 Z M10,21 A2.5,2.5 0 1,0 15,21 A2.5,2.5 0 1,0 10,21 Z M31,21 A2.5,2.5 0 1,0 36,21 A2.5,2.5 0 1,0 31,21 Z",
    minivan: "M6,20 L6,14 C6,12 8,10 12,10 L18,9.5 C22,9 28,9 32,9.5 L36,10 C39,11 40,13 40,15 L40,20 Z M8,20 L8,17 L38,17 L38,20 Z M10,21 A2.5,2.5 0 1,0 15,21 A2.5,2.5 0 1,0 10,21 Z M31,21 A2.5,2.5 0 1,0 36,21 A2.5,2.5 0 1,0 31,21 Z",
  };

  return (
    <svg viewBox="0 0 48 28" className="w-full h-full" fill="none">
      <path d={paths[type] || paths.sedan} fill={color} opacity="0.9" />
      {/* Windshield highlight */}
      <path d="M18,15 L20,11.5 L28,11.5 L30,15 Z" fill="white" opacity="0.25" />
      {/* Ground shadow */}
      <ellipse cx="24" cy="23" rx="14" ry="1.5" fill="black" opacity="0.12" />
    </svg>
  );
}

function guessVehicleType(make = '', model = '') {
  const m = (make + ' ' + model).toLowerCase();
  if (/truck|f-150|tacoma|silverado|ram|tundra|frontier|ranger|colorado/.test(m)) return 'truck';
  if (/suv|cr-v|rav4|explorer|pilot|highlander|traverse|tahoe|suburban|4runner|equinox|escape|rogue|cherokee|sorento|telluride|outback|forester/.test(m)) return 'suv';
  if (/minivan|sienna|odyssey|pacifica|caravan/.test(m)) return 'minivan';
  return 'sedan';
}

const colorMap = {
  white: '#f1f5f9', silver: '#94a3b8', gray: '#6b7280', grey: '#6b7280',
  black: '#1e293b', red: '#ef4444', blue: '#3b82f6', navy: '#1e3a5f',
  green: '#22c55e', yellow: '#eab308', gold: '#f59e0b', orange: '#f97316',
  brown: '#92400e', beige: '#d6b98c', maroon: '#7f1d1d', purple: '#7c3aed',
  pink: '#ec4899', teal: '#14b8a6', bronze: '#a16207', champagne: '#e8d5a3',
};

function parseColor(colorStr = '') {
  const key = colorStr.toLowerCase().trim();
  return colorMap[key] || '#6366f1';
}

export default function VehicleCard({ vehicle, index = 0, onClick }) {
  const status = statusConfig[vehicle.status] || statusConfig.available;
  const vehicleType = guessVehicleType(vehicle.make, vehicle.model);
  const carColor = parseColor(vehicle.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer select-none"
    >
      {/* Car image area */}
      <div className="relative h-36 bg-gradient-to-br from-secondary/60 to-secondary flex items-center justify-center px-4 pt-2 pb-1 overflow-hidden">
        {/* Status pill */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black text-white ${status.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
          {status.label}
        </div>

        {vehicle.photo_url ? (
          <img src={vehicle.photo_url} alt={`${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover absolute inset-0 rounded-t-3xl" />
        ) : (
          <div className="w-48 h-24 drop-shadow-lg">
            <CarSilhouette type={vehicleType} color={carColor} />
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-black text-sm leading-tight truncate">
              {vehicle.year && `${vehicle.year} `}{vehicle.make} {vehicle.model}
            </p>
            {vehicle.color && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2.5 h-2.5 rounded-full border border-border flex-shrink-0" style={{ backgroundColor: carColor }} />
                <span className="text-[11px] text-muted-foreground font-medium capitalize">{vehicle.color}</span>
              </div>
            )}
            {vehicle.owner_name && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">👤 {vehicle.owner_name}</p>
            )}
          </div>
          {/* License plate badge */}
          <div className="flex-shrink-0 bg-foreground text-background rounded-lg px-2 py-1 text-[11px] font-black tracking-widest border-2 border-foreground">
            {vehicle.license_plate}
          </div>
        </div>
      </div>
    </motion.div>
  );
}