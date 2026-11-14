import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-12',
}

const TEXT_SIZE_CLASSES: Record<
  NonNullable<UserAvatarProps['size']>,
  string
> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
}

const getInitials = (name: string): string => {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const UserAvatar = ({ name, size = 'md', className }: UserAvatarProps) => {
  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)} aria-hidden>
      <AvatarFallback
        className={cn(
          'bg-gradient-avatar font-display font-medium text-white',
          TEXT_SIZE_CLASSES[size],
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export { UserAvatar, getInitials }
export type { UserAvatarProps }
