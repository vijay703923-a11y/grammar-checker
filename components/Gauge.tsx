
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface GaugeProps {
  value: number;
  label: string;
  color: string;
}

export const Gauge: React.FC<GaugeProps> = ({ value, label, color }) => {
  const data = [
    { name: 'Value', value: value },
    { name: 'Remaining', value: 100 - value },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="h-32 w-32 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={50}
              startAngle={180}
              endAngle={0}
              paddingAngle={0}
              dataKey="value"
              animationBegin={0}
              animationDuration={1500}
            >
              <Cell fill={color} stroke="none" />
              <Cell fill="#f1f5f9" stroke="none" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <span className="text-xl font-black text-slate-700">{value}%</span>
        </div>
      </div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{label}</span>
    </div>
  );
};
