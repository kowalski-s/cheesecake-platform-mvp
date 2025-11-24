import { useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"

/**
 * Компонент аватара с цветным фоном и инициалом или загруженным изображением
 * Используется в профиле и в верхнем меню пользователя
 */
export default function Avatar({ 
  displayName = "", 
  email = "", 
  size = "md",
  className = "",
  avatarUrl = null
}) {
  const initials = useMemo(() => {
    const name = displayName?.trim() || ""
    if (name) {
      // Берем первую букву имени
      return name[0].toUpperCase()
    }
    // Если имени нет, берем первую букву email
    const letter = email?.split("@")[0]?.[0] || "?"
    return String(letter).toUpperCase()
  }, [displayName, email])

  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-16 w-16 text-2xl",
    lg: "h-20 w-20 text-3xl"
  }

  // Получаем URL изображения из Supabase Storage
  const imageUrl = useMemo(() => {
    if (!avatarUrl) return null
    if (avatarUrl.startsWith('http')) return avatarUrl
    try {
      const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl)
      return data?.publicUrl || null
    } catch {
      return null
    }
  }, [avatarUrl])

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-semibold shadow-md overflow-hidden ${className}`}
      title={displayName || email}
    >
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={displayName || email}
          className="w-full h-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  )
}

