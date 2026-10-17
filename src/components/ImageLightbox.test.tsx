import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImageLightbox, type LightboxImage } from './ImageLightbox'

const IMG: LightboxImage = { src: '/images/obzor-01.png', alt: 'Окно редактора' }

describe('ImageLightbox', () => {
  it('не рендерится, пока изображение не выбрано', () => {
    render(<ImageLightbox image={null} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('показывает изображение на всё окно с подписью и крестиком', () => {
    render(<ImageLightbox image={IMG} onClose={() => {}} />)
    const box = screen.getByRole('dialog', { name: 'Скриншот на всё окно' })
    expect(box).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('img', { name: 'Окно редактора' })).toHaveAttribute('src', IMG.src)
    expect(screen.getByText('Окно редактора')).toBeInTheDocument()
    expect(screen.getByLabelText('Закрыть скриншот')).toBeInTheDocument()
  })

  it('клик по картинке, по фону и по крестику закрывает просмотр', () => {
    const onClose = vi.fn()
    render(<ImageLightbox image={IMG} onClose={onClose} />)
    fireEvent.click(screen.getByRole('img'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByLabelText('Закрыть скриншот'))
    // Крестик гасит всплытие: ровно один вызов, а не два (свой + от фона)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('закрытие плавное: слой гаснет (is-closing) и снимается не сразу', async () => {
    const { rerender } = render(<ImageLightbox image={IMG} onClose={() => {}} />)
    rerender(<ImageLightbox image={null} onClose={() => {}} />)
    const box = screen.getByRole('dialog')
    expect(box).toHaveClass('is-closing')
    // Картинка дорисовывается, пока фон гаснет
    expect(screen.getByRole('img')).toHaveAttribute('src', IMG.src)
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('повторное открытие до конца fade отменяет снятие и показывает новый кадр', async () => {
    const { rerender } = render(<ImageLightbox image={IMG} onClose={() => {}} />)
    rerender(<ImageLightbox image={null} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveClass('is-closing')
    const next: LightboxImage = { src: '/images/quick-start-02.png', alt: 'Панель пулов' }
    rerender(<ImageLightbox image={next} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).not.toHaveClass('is-closing')
    expect(screen.getByRole('img')).toHaveAttribute('src', next.src)
    await new Promise((resolve) => setTimeout(resolve, 250))
    // Таймер закрытия очищен — слой не исчез самопроизвольно
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('без alt подписи под изображением нет', () => {
    render(<ImageLightbox image={{ src: '/x.png', alt: '' }} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.querySelector('.lightbox__caption')).toBeNull()
  })
})
