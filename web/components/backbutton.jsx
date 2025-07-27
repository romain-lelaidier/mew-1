import { useNavigate } from "@solidjs/router"

export function BackButton() {
  const navigate = useNavigate();
  return (
    <button class="absolute top-2 left-2 z-1" onClick={() => navigate(-1)}>
      <div class="flex items-center justify-center w-10 h-10 rounded-full bg-d shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="w-6 h-6">
          <path d="M201.4 297.4C188.9 309.9 188.9 330.2 201.4 342.7L361.4 502.7C373.9 515.2 394.2 515.2 406.7 502.7C419.2 490.2 419.2 469.9 406.7 457.4L269.3 320L406.6 182.6C419.1 170.1 419.1 149.8 406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3L201.3 297.3z"/>
        </svg>
      </div>
    </button>
  )
}