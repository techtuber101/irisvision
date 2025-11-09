'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { Document, Page, pdfjs } from 'react-pdf';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfRendererProps {
  url: string;
  className?: string;
}

type PageMetrics = Record<number, { aspectRatio: number }>;

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.2;
const DEFAULT_ASPECT_RATIO = 1.294; // Close to US Letter
const DARK_BUTTON =
  'px-2 py-1 rounded bg-[rgba(15,23,42,0.85)] text-white hover:bg-[rgba(15,23,42,0.95)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

const PageSkeleton = ({ height, width, pageNumber }: { height: number; width: number; pageNumber: number }) => (
  <div
    className="border border-white/10 rounded-lg bg-[rgba(15,23,42,0.4)] w-full flex flex-col items-center justify-center text-xs text-white/60"
    style={{ height, maxWidth: width }}
  >
    Loading page {pageNumber}...
  </div>
);

export function PdfRenderer({ url, className }: PdfRendererProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageMetrics, setPageMetrics] = useState<PageMetrics>({});
  const [pagesNearViewport, setPagesNearViewport] = useState<Set<number>>(
    () => new Set([1]),
  );
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pagesWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentPage(1);
    setPagesNearViewport(new Set([1]));
    setPageMetrics({});
    pageContainerRefs.current = {};
  }, [url]);

  useEffect(() => {
    if (!pagesWrapperRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });

    resizeObserver.observe(pagesWrapperRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const handleDocumentLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const handlePageLoad = useCallback((pageNumber: number, page: pdfjs.PDFPageProxy) => {
    setPageMetrics(prev => {
      if (prev[pageNumber]) return prev;
      const viewport = page.getViewport({ scale: 1 });
      const aspectRatio = viewport.height / viewport.width || DEFAULT_ASPECT_RATIO;
      return { ...prev, [pageNumber]: { aspectRatio } };
    });
  }, []);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    setPagesNearViewport(prev => {
      let mutated = false;
      const next = new Set(prev);

      entries.forEach(entry => {
        const attr = entry.target.getAttribute('data-page-number');
        if (!attr) return;
        const pageNumber = Number(attr);
        if (Number.isNaN(pageNumber)) return;

        if (entry.isIntersecting) {
          if (!next.has(pageNumber)) {
            next.add(pageNumber);
            mutated = true;
          }
        } else if (next.has(pageNumber)) {
          next.delete(pageNumber);
          mutated = true;
        }
      });

      return mutated ? next : prev;
    });

    const mostVisible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (mostVisible) {
      const attr = mostVisible.target.getAttribute('data-page-number');
      const pageNumber = attr ? Number(attr) : undefined;
      if (pageNumber && !Number.isNaN(pageNumber)) {
        setCurrentPage(prev => (prev === pageNumber ? prev : pageNumber));
      }
    }
  }, []);

  useEffect(() => {
    if (!scrollContainerRef.current) return undefined;

    const observer = new IntersectionObserver(handleIntersection, {
      root: scrollContainerRef.current,
      threshold: 0.35,
    });
    observerRef.current = observer;

    Object.values(pageContainerRefs.current).forEach(node => {
      if (node) observer.observe(node);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [handleIntersection, numPages]);

  const updatePageRef = useCallback((pageNumber: number, node: HTMLDivElement | null) => {
    const existing = pageContainerRefs.current[pageNumber];
    if (existing && observerRef.current) {
      observerRef.current.unobserve(existing);
    }

    pageContainerRefs.current[pageNumber] = node;

    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  const scrollToPage = useCallback((pageNumber: number) => {
    const container = scrollContainerRef.current;
    const target = pageContainerRefs.current[pageNumber];
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - containerRect.top + container.scrollTop - 16;

    container.scrollTo({
      top: offset,
      behavior: 'smooth',
    });
  }, []);

  const changePage = useCallback((nextPage: number) => {
    if (!numPages) return;
    const clamped = Math.min(Math.max(nextPage, 1), numPages);
    setCurrentPage(clamped);
    scrollToPage(clamped);
  }, [numPages, scrollToPage]);

  const goToPreviousPage = useCallback(() => {
    changePage(currentPage - 1);
  }, [changePage, currentPage]);

  const goToNextPage = useCallback(() => {
    changePage(currentPage + 1);
  }, [changePage, currentPage]);

  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const renderedPages = useMemo(() => {
    if (!numPages) return new Set<number>([1]);
    const toRender = new Set<number>();
    const expandAround = (page: number, radius: number) => {
      for (let i = page - radius; i <= page + radius; i += 1) {
        if (i >= 1 && i <= numPages) {
          toRender.add(i);
        }
      }
    };

    expandAround(currentPage, 3);
    pagesNearViewport.forEach(page => expandAround(page, 2));

    if (!toRender.size) {
      expandAround(1, 3);
    }

    return toRender;
  }, [currentPage, numPages, pagesNearViewport]);

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, idx) => idx + 1),
    [numPages],
  );

  const baseWidth = useMemo(() => {
    if (!containerWidth) return 800;
    return Math.min(containerWidth - 32, 1200);
  }, [containerWidth]);

  const pageWidth = baseWidth * zoom;

  if (!url) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-muted/20 rounded-md', className)}>
        <span className="text-sm text-muted-foreground">No PDF to display</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col w-full h-full', className)}>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto rounded-md bg-[rgba(15,23,42,0.25)] border border-white/5"
      >
        <div ref={pagesWrapperRef} className="w-full max-w-5xl mx-auto py-6 px-4">
          <Document
            file={url}
            onLoadSuccess={handleDocumentLoad}
            loading={
              <div className="w-full h-64 flex items-center justify-center text-white/70 text-sm">
                Loading document...
              </div>
            }
            className="flex flex-col gap-6"
          >
            {numPages > 0 &&
              pageNumbers.map(pageNumber => {
                const aspectRatio =
                  pageMetrics[pageNumber]?.aspectRatio ?? DEFAULT_ASPECT_RATIO;
                const placeholderHeight = pageWidth * aspectRatio;
                const shouldRender = renderedPages.has(pageNumber);

                return (
                  <div
                    key={`pdf-page-${pageNumber}`}
                    data-page-number={pageNumber}
                    ref={node => updatePageRef(pageNumber, node)}
                    className="flex justify-center"
                    style={{ scrollMarginTop: 24 }}
                  >
                    {shouldRender ? (
                      <Page
                        pageNumber={pageNumber}
                        width={pageWidth}
                        renderTextLayer
                        renderAnnotationLayer
                        className="border border-white/10 rounded-lg bg-white shadow-lg"
                        loading={<PageSkeleton height={placeholderHeight} width={pageWidth} pageNumber={pageNumber} />}
                        onLoadSuccess={page => handlePageLoad(pageNumber, page)}
                      />
                    ) : (
                      <PageSkeleton
                        height={placeholderHeight}
                        width={pageWidth}
                        pageNumber={pageNumber}
                      />
                    )}
                  </div>
                );
              })}
          </Document>
        </div>
      </div>

      {numPages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t border-white/10 bg-[rgba(15,23,42,0.6)]">
          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className={DARK_BUTTON}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              -
            </button>
            <span className="text-white/80 text-sm min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className={DARK_BUTTON}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>

          <div className="flex items-center space-x-2 text-white/80 text-sm">
            <button
              onClick={goToPreviousPage}
              className={DARK_BUTTON}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={goToNextPage}
              className={DARK_BUTTON}
              disabled={currentPage >= numPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
