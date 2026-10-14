import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/shared/format";

import type { FileOutcomeCounts } from "../report";

/** One row per source file: how many rows it had and what happened to them. */
export function FileOutcomesTable({ files }: { files: FileOutcomeCounts[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead className="text-right">Rows</TableHead>
          <TableHead className="text-right">Loaded</TableHead>
          <TableHead className="text-right">Merged</TableHead>
          <TableHead className="text-right">Set aside</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.file}>
            <TableCell className="font-mono text-sm">{file.file}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(file.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(file.loaded)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(file.merged)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(file.setAside)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
