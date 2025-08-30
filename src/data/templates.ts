import { Template } from '@/types/template'

export const templatesData: Template[] = [
  {
    id: 'old-photo-animation',
    name: 'Old Photo Animation Maker',
    description: 'Bring old photos to life with AI animation',
    icon: '📷',
    category: 'animation',
    credits: 5,
    promptTemplate: 'Animate this old photograph {image} to show natural movements and expressions, maintaining the vintage aesthetic',
    parameters: [
      {
        type: 'image',
        name: 'photo',
        label: 'Image',
        placeholder: 'Click to upload an image',
        required: true,
        accept: 'image/*'
      },
      {
        type: 'toggle',
        name: 'makePublic',
        label: 'Make video public',
        default: false
      }
    ],
    previewUrl: 'https://via.placeholder.com/600x400/4a5568/ffffff?text=Old+Photo+Animation',
    thumbnailUrl: 'https://via.placeholder.com/300x200/4a5568/ffffff?text=Old+Photo',
    tags: ['animation', 'vintage', 'photo']
  },
  {
    id: 'skateboarding-cat',
    name: 'Skateboarding Cat',
    description: 'A slightly zoomed-in video of a cat sliding down a hill on a skateboard',
    icon: '🐱',
    category: 'fun',
    credits: 8,
    promptTemplate: 'A slightly zoomed-in, slightly shaky video shot on a smartphone focuses on a realistic {animal} sliding down a hill on a skateboard. The {animal} looks surprisingly relaxed, using its arms to adjust its balance from time to time.',
    parameters: [
      {
        type: 'select',
        name: 'animal',
        label: 'Animal Type',
        required: true,
        options: [
          { value: 'cat', label: 'Cat' },
          { value: 'dog', label: 'Dog' },
          { value: 'rabbit', label: 'Rabbit' },
          { value: 'hamster', label: 'Hamster' }
        ],
        default: 'cat'
      },
      {
        type: 'text',
        name: 'location',
        label: 'Location',
        placeholder: 'e.g., park, street, backyard',
        required: false,
        default: 'park'
      },
      {
        type: 'slider',
        name: 'duration',
        label: 'Video Duration (seconds)',
        min: 5,
        max: 30,
        step: 5,
        default: 10
      },
      {
        type: 'toggle',
        name: 'makePublic',
        label: 'Make video public',
        default: true
      }
    ],
    previewUrl: 'https://via.placeholder.com/600x400/6b46c1/ffffff?text=Skateboarding+Cat',
    thumbnailUrl: 'https://via.placeholder.com/300x200/6b46c1/ffffff?text=Cat',
    tags: ['fun', 'animal', 'sports']
  },
  {
    id: 'ocean-sunset',
    name: 'Ocean Sunset',
    description: 'Beautiful sunset over the ocean waves with customizable elements',
    icon: '🌅',
    category: 'nature',
    credits: 3,
    promptTemplate: 'A breathtaking {timeOfDay} scene over the {waterBody} with {mood} atmosphere, featuring {elements}',
    parameters: [
      {
        type: 'select',
        name: 'timeOfDay',
        label: 'Time of Day',
        required: true,
        options: [
          { value: 'sunrise', label: 'Sunrise' },
          { value: 'sunset', label: 'Sunset' },
          { value: 'golden hour', label: 'Golden Hour' }
        ],
        default: 'sunset'
      },
      {
        type: 'select',
        name: 'waterBody',
        label: 'Water Body',
        required: true,
        options: [
          { value: 'ocean', label: 'Ocean' },
          { value: 'lake', label: 'Lake' },
          { value: 'river', label: 'River' }
        ],
        default: 'ocean'
      },
      {
        type: 'text',
        name: 'elements',
        label: 'Additional Elements',
        placeholder: 'e.g., birds, boats, surfers',
        required: false
      },
      {
        type: 'select',
        name: 'mood',
        label: 'Mood',
        options: [
          { value: 'peaceful', label: 'Peaceful' },
          { value: 'dramatic', label: 'Dramatic' },
          { value: 'romantic', label: 'Romantic' }
        ],
        default: 'peaceful'
      },
      {
        type: 'number',
        name: 'duration',
        label: 'Duration (seconds)',
        min: 5,
        max: 60,
        step: 5,
        default: 15
      }
    ],
    previewUrl: 'https://via.placeholder.com/600x400/f97316/ffffff?text=Ocean+Sunset',
    thumbnailUrl: 'https://via.placeholder.com/300x200/f97316/ffffff?text=Sunset',
    tags: ['nature', 'scenic', 'relaxing']
  }
]