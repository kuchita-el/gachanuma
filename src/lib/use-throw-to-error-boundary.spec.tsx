import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Component, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useThrowToErrorBoundary } from './use-throw-to-error-boundary'
import { Button } from '@/components/ui/button'

function Trigger({ value }: { value: unknown }) {
  const throwToErrorBoundary = useThrowToErrorBoundary()
  return (
    <Button type="button" onClick={() => throwToErrorBoundary(value)}>
      throw
    </Button>
  )
}

class CapturingBoundary extends Component<
  { onCatch: (e: Error) => void, children: ReactNode },
  { caught: boolean }
> {
  state = { caught: false }
  static getDerivedStateFromError(): { caught: boolean } {
    return { caught: true }
  }

  componentDidCatch(error: Error): void {
    this.props.onCatch(error)
  }

  render(): ReactNode {
    if (this.state.caught) return <div data-testid="caught" />
    return this.props.children
  }
}

describe('useThrowToErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('Error インスタンスはそのまま Boundary に届く', async () => {
    const user = userEvent.setup()
    const original = new TypeError('boom')
    const captured: Error[] = []
    render(
      <CapturingBoundary onCatch={e => captured.push(e)}>
        <Trigger value={original} />
      </CapturingBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'throw' }))
    expect(await screen.findByTestId('caught')).toBeInTheDocument()
    expect(captured[0]).toBe(original)
  })

  it('string 値は Error にラップされ message と cause に元値を保持する', async () => {
    const user = userEvent.setup()
    const captured: Error[] = []
    render(
      <CapturingBoundary onCatch={e => captured.push(e)}>
        <Trigger value="文字列エラー" />
      </CapturingBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'throw' }))
    expect(await screen.findByTestId('caught')).toBeInTheDocument()
    expect(captured[0]).toBeInstanceOf(Error)
    expect(captured[0]?.message).toBe('文字列エラー')
    expect(captured[0]?.cause).toBe('文字列エラー')
  })

  it('null は Error にラップされ cause に元値を保持する', async () => {
    const user = userEvent.setup()
    const captured: Error[] = []
    render(
      <CapturingBoundary onCatch={e => captured.push(e)}>
        <Trigger value={null} />
      </CapturingBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'throw' }))
    expect(await screen.findByTestId('caught')).toBeInTheDocument()
    expect(captured[0]).toBeInstanceOf(Error)
    expect(captured[0]?.cause).toBeNull()
  })

  it('plain object は Error にラップされ cause に元値を保持する', async () => {
    const user = userEvent.setup()
    const original = { code: 42, detail: 'wat' }
    const captured: Error[] = []
    render(
      <CapturingBoundary onCatch={e => captured.push(e)}>
        <Trigger value={original} />
      </CapturingBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'throw' }))
    expect(await screen.findByTestId('caught')).toBeInTheDocument()
    expect(captured[0]).toBeInstanceOf(Error)
    expect(captured[0]?.cause).toBe(original)
  })
})
