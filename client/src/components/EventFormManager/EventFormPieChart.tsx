import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

export interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface EventFormPieChartProps {
  data: PieSlice[];
  height?: number;
  formatTooltip?: (value: number, name: string) => string | [string, string];
}

export default function EventFormPieChart({
  data,
  height = 300,
  formatTooltip,
}: EventFormPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={false}
          outerRadius={80}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) =>
            formatTooltip
              ? formatTooltip(Number(value), String(name))
              : String(value)
          }
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
