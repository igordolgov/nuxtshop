// server/data/generate-products.js
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const products = [
  {
    id: "1",
    slug: "umnaya-kolonka-yandeks-stantsiya",
    name: "Умная колонка Яндекс Станция",
    price: 9990,
    description: "Умная колонка с голосовым помощником Алиса",
    categories: ["Умный дом", "Аудиотехника"],
    image: "/images/products/yandex-station.jpg",
    gallery: [],
    inStock: true,
    stockQuantity: 15,
    createdAt: "2024-01-15",
    isFavorite: false
  },
  {
    id: "2",
    slug: "elektrosamokat-xiaomi-pro-2",
    name: "Электросамокат Xiaomi Pro 2",
    price: 29990,
    description: "Электросамокат с мощным двигателем",
    categories: ["Транспорт"],
    image: "/images/products/xiaomi-scooter.jpg",
    gallery: [],
    inStock: true,
    stockQuantity: 8,
    createdAt: "2024-01-10",
    isFavorite: false
  },
  {
    id: "3",
    slug: "noutbuk-apple-macbook-air",
    name: "Ноутбук Apple MacBook Air",
    price: 89990,
    description: "Легкий и мощный ноутбук от Apple",
    categories: ["Ноутбуки", "Компьютеры"],
    image: "/images/products/macbook-air.jpg",
    gallery: [],
    inStock: true,
    stockQuantity: 5,
    createdAt: "2024-01-05",
    isFavorite: false
  },
  {
    id: "4",
    slug: "smartfon-samsung-galaxy-s23",
    name: "Смартфон Samsung Galaxy S23",
    price: 69990,
    description: "Флагманский смартфон от Samsung",
    categories: ["Смартфоны", "Электроника"],
    image: "/images/products/samsung-s23.jpg",
    gallery: [],
    inStock: true,
    stockQuantity: 12,
    createdAt: "2024-01-12",
    isFavorite: false
  },
  {
    id: "5",
    slug: "igrovaya-konsole-playstation-5",
    name: "Игровая консоль PlayStation 5",
    price: 59990,
    description: "Новое поколение игровых консолей от Sony",
    categories: ["Игровые консоли"],
    image: "/images/products/ps5.jpg",
    gallery: [],
    inStock: true,
    stockQuantity: 3,
    createdAt: "2024-01-08",
    isFavorite: false
  }
]

const filePath = join(__dirname, 'products.json')

try {
  writeFileSync(filePath, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`✅ Файл products.json успешно создан с ${products.length} товарами`)
  console.log(`📁 Путь: ${filePath}`)
} catch (error) {
  console.error('❌ Ошибка создания файла:', error)
}