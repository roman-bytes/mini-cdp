import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** The same numbers a chart draws, as rows, so nothing depends on seeing the chart. */
export type ChartTableData = {
  columns: string[];
  rows: (string | number)[][];
};

type ChartCardProps = {
  title: string;
  description: string;
  table: ChartTableData;
  children: React.ReactNode;
  className?: string;
};

/** A chart with its title, a one-line reading, and a table view underneath. */
export function ChartCard({ title, description, table, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                {table.columns.map((column, index) => (
                  <TableHead key={column} className={index === 0 ? undefined : "text-right"}>
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row) => (
                <TableRow key={String(row[0])}>
                  {row.map((cell, index) => (
                    <TableCell key={index} className={index === 0 ? undefined : "text-right tabular-nums"}>
                      {typeof cell === "number" ? cell.toLocaleString("en-US") : cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      </CardContent>
    </Card>
  );
}
