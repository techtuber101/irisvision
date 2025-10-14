import type React from "react"
import { Check, Clock, CheckCircle, AlertTriangle, ListTodo, X, Circle, CircleCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { extractTaskListData, type Task, type Section } from "./_utils"
import { getToolTitle } from "../utils"
import type { ToolViewProps } from "../types"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from "@/components/ui/scroll-area"

const TaskItem: React.FC<{ task: Task; index: number }> = ({ task, index }) => {
  const isCompleted = task.status === "completed"
  const isCancelled = task.status === "cancelled"
  const isPending = !isCompleted && !isCancelled

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {isCompleted && <CircleCheck className="h-4 w-4 text-green-500 dark:text-green-400" />}
        {isCancelled && <X className="h-4 w-4 text-red-500 dark:text-red-400" />}
        {isPending && <Circle className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />}
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-relaxed",
            isCompleted && "text-zinc-900 dark:text-zinc-100",
            isCancelled && "text-zinc-500 dark:text-zinc-400 line-through",
            isPending && "text-zinc-600 dark:text-zinc-300",
          )}
        >
          {task.content}
        </p>
      </div>
    </div>
  )
}

const SectionHeader: React.FC<{ section: Section }> = ({ section }) => {
  const totalTasks = section.tasks.length
  const completedTasks = section.tasks.filter((t) => t.status === "completed").length

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-zinc-50/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-700">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{section.title}</h3>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs h-5 px-2 py-0 font-normal bg-white dark:bg-zinc-800">
          {completedTasks}/{totalTasks}
        </Badge>
        {completedTasks === totalTasks && totalTasks > 0 && (
          <Badge variant="outline" className="text-xs h-5 px-2 py-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
            <Check className="h-3 w-3" />
          </Badge>
        )}
      </div>
    </div>
  )
}

const SectionView: React.FC<{ section: Section }> = ({ section }) => {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <SectionHeader section={section} />
      <div className="bg-card">
        {section.tasks.map((task, index) => (
          <TaskItem key={task.id} task={task} index={index} />
        ))}
        {section.tasks.length === 0 && (
          <div className="py-6 px-4 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No tasks in this section</p>
          </div>
        )}
      </div>
    </div>
  )
}



export const TaskListToolView: React.FC<ToolViewProps> = ({
  name = 'task-list',
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false
}) => {
  const taskData = extractTaskListData(assistantContent, toolContent)
  const toolTitle = getToolTitle(name)

  // Process task data
  const sections = taskData?.sections || []
  const allTasks = sections.flatMap((section) => section.tasks)
  const totalTasks = taskData?.total_tasks || 0

  const completedTasks = allTasks.filter((t) => t.status === "completed").length
  const hasData = taskData?.total_tasks && taskData?.total_tasks > 0

  return (
    <Card className="gap-0 flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-card">
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/20">
              <ListTodo className="w-5 h-5 text-green-500 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {toolTitle}
              </CardTitle>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-end gap-1.5">
            <div className="relative rounded-xl border border-emerald-400/20 bg-emerald-400/10 backdrop-blur-sm px-2.5 py-1.5">
              {/* Gradient rim */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl" style={{
                background: 'linear-gradient(180deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05) 30%, rgba(16,185,129,0.10) 85%, rgba(16,185,129,0.08))',
                WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                padding: '1px',
                borderRadius: '12px'
              }} />
              {/* Specular streak */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{
                background: 'linear-gradient(180deg, rgba(16,185,129,0.25), rgba(16,185,129,0.08) 45%, rgba(16,185,129,0) 100%)',
                filter: 'blur(3px)',
                mixBlendMode: 'screen'
              }} />
              {/* Fine noise */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                backgroundSize: '100px 100px',
                mixBlendMode: 'overlay'
              }} />
              <span className="relative z-10 text-xs font-medium text-emerald-300">{completedTasks}/{totalTasks} tasks accomplished</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
        {isStreaming && !hasData ? (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-green-100 to-green-50 shadow-inner dark:from-green-800/40 dark:to-green-900/60">
              <Clock className="h-10 w-10 text-green-500 dark:text-green-400 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              Loading Tasks
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Preparing your task list...
            </p>
          </div>
        ) : hasData ? (
          <ScrollArea className="h-full w-full">
            <div className="py-0">
              {sections.map((section) => <SectionView key={section.id} section={section} />)}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-zinc-100 to-zinc-50 shadow-inner dark:from-zinc-800/40 dark:to-zinc-900/60">
              <ListTodo className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              No Tasks Yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your task list will appear here once created
            </p>
          </div>
        )}
      </CardContent>
      <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
        <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {!isStreaming && hasData && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-6 py-0.5">
                <ListTodo className="h-3 w-3" />
                {sections.length} sections
              </Badge>
              {completedTasks === totalTasks && totalTasks > 0 && (
                <Badge variant="outline" className="h-6 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200 dark:border-green-700">
                  <Check className="h-3 w-3" />
                  All complete
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {toolTimestamp && !isStreaming
            ? new Date(toolTimestamp).toLocaleTimeString()
            : assistantTimestamp
              ? new Date(assistantTimestamp).toLocaleTimeString()
              : ''}
        </div>
      </div>
    </Card>
  )
}
