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
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {isCompleted && <CircleCheck className="h-4 w-4 text-green-400" />}
        {isCancelled && <X className="h-4 w-4 text-red-400" />}
        {isPending && <Circle className="h-4 w-4 text-white/40" />}
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-relaxed",
            isCompleted && "text-white/90",
            isCancelled && "text-white/50 line-through",
            isPending && "text-white/70",
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
    <div className="flex items-center justify-between py-3 px-4 bg-white/5 backdrop-blur-sm border-b border-white/10">
      <h3 className="text-sm font-medium text-white/80">{section.title}</h3>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs h-5 px-2 py-0 font-normal bg-white/10 border-white/20 text-white/80">
          {completedTasks}/{totalTasks}
        </Badge>
        {completedTasks === totalTasks && totalTasks > 0 && (
          <Badge variant="outline" className="text-xs h-5 px-2 py-0 bg-green-500/20 text-green-400 border-green-500/30">
            <Check className="h-3 w-3" />
          </Badge>
        )}
      </div>
    </div>
  )
}

const SectionView: React.FC<{ section: Section }> = ({ section }) => {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <SectionHeader section={section} />
      <div className="bg-transparent">
        {section.tasks.map((task, index) => (
          <TaskItem key={task.id} task={task} index={index} />
        ))}
        {section.tasks.length === 0 && (
          <div className="py-6 px-4 text-center">
            <p className="text-xs text-white/50">No tasks in this section</p>
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
    <Card className="gap-0 flex border shadow-none border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-transparent relative">
      <CardHeader className="h-14 bg-transparent p-2 px-4 space-y-2 relative z-10 border-t-0">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20">
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
              <ListTodo className="w-5 h-5 text-emerald-300 relative z-10" />
            </div>
            <div>
              <CardTitle className="text-base font-medium text-white/90">
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

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative z-10">
        {isStreaming && !hasData ? (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-transparent to-white/5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-green-500/20 to-green-600/10 border border-green-500/20 backdrop-blur-sm">
              <Clock className="h-10 w-10 text-green-400 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white/90">
              Loading Tasks
            </h3>
            <p className="text-sm text-white/60">
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
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-transparent to-white/5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 backdrop-blur-sm">
              <ListTodo className="h-10 w-10 text-white/40" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white/90">
              No Tasks Yet
            </h3>
            <p className="text-sm text-white/60">
              Your task list will appear here once created
            </p>
          </div>
        )}
      </CardContent>
      <div className="px-4 py-2 h-10 bg-white/5 backdrop-blur-sm border-t border-white/10 flex justify-between items-center gap-4 relative z-10">
        <div className="h-full flex items-center gap-2 text-sm text-white/60">
          {!isStreaming && hasData && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-6 py-0.5 bg-white/10 border-white/20 text-white/80">
                <ListTodo className="h-3 w-3" />
                {sections.length} sections
              </Badge>
              {completedTasks === totalTasks && totalTasks > 0 && (
                <Badge variant="outline" className="h-6 py-0.5 bg-green-500/20 text-green-400 border-green-500/30">
                  <Check className="h-3 w-3" />
                  All complete
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="text-xs text-white/60">
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
