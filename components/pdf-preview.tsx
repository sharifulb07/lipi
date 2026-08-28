"use client";
import { useEffect,useMemo } from "react";
export default function PdfPreview({file}:{file:File}){const url=useMemo(()=>URL.createObjectURL(file),[file]);useEffect(()=>()=>URL.revokeObjectURL(url),[url]);return <div className="pdf-preview"><iframe src={url} title="PDF preview"/></div>}
