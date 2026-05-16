import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const getInitials = (name?: string) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "BM";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};

interface UserAvatarProps {
  name?: string;
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

const UserAvatar = ({ name, imageUrl, className, fallbackClassName }: UserAvatarProps) => {
  return (
    <Avatar
      className={cn(
        "border border-primary/30 shadow-[0_10px_24px_-18px_hsl(var(--shadow-color))]",
        className,
      )}
    >
      {imageUrl ? <AvatarImage src={imageUrl} alt={name || "Usuário"} /> : null}
      <AvatarFallback className={cn("bg-primary/12 text-xs font-semibold text-primary", fallbackClassName)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
