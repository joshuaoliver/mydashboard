import { useState } from 'react'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Lock } from 'lucide-react'

const CORRECT_PIN = "2010"

interface PinEntryProps {
  onUnlock: () => void
}

export function PinEntry({ onUnlock }: PinEntryProps) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)

  const handleComplete = (value: string) => {
    if (value === CORRECT_PIN) {
      setError(false)
      // Store unlock state in session storage
      sessionStorage.setItem('app-unlocked', 'true')
      onUnlock()
    } else {
      setError(true)
      // Clear the PIN after a short delay on error
      setTimeout(() => {
        setPin("")
        setError(false)
      }, 1000)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center space-y-6">
          {/* Lock Icon */}
          <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center">
            <Lock className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter PIN</h1>
            <p className="text-sm text-gray-600">
              Enter your PIN code to access the dashboard
            </p>
          </div>

          {/* PIN Input */}
          <div className="flex flex-col items-center gap-4">
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={(value) => {
                setPin(value)
                setError(false)
                if (value.length === 4) {
                  handleComplete(value)
                }
              }}
              autoFocus
            >
              <InputOTPGroup className="gap-3">
                <InputOTPSlot index={0} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={1} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={2} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={3} className="w-14 h-14 text-2xl" />
              </InputOTPGroup>
            </InputOTP>
            {error && (
              <div className="text-sm text-red-600 font-medium animate-shake">
                Incorrect PIN. Please try again.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

