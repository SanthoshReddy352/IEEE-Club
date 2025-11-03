'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'

export default function DynamicForm({ fields = [], onSubmit, eventId }) {
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (fieldLabel, value) => {
    // FIX: Use fieldLabel directly as the key for storing data
    setFormData({ ...formData, [fieldLabel]: value })
    // Clear error when user starts typing
    if (errors[fieldLabel]) {
      setErrors({ ...errors, [fieldLabel]: null })
    }
  }

  const validateForm = () => {
    const newErrors = {}
    fields.forEach((field) => {
      // Use the field.label consistently for error tracking
      const fieldKey = field.label; 
      if (field.required && !formData[fieldKey]) {
        newErrors[fieldKey] = `${field.label} is required`
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderField = (field) => {
    // FIX: Use field.label as the unique identifier for the form elements
    const fieldId = field.label 
    const value = formData[fieldId] || ''

    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
      case 'url':
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type={field.type}
              value={value}
              onChange={(e) => handleInputChange(field.label, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              required={field.required}
            />
            {errors[fieldId] && (
              <p className="text-red-500 text-sm">{errors[fieldId]}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={fieldId}
              value={value}
              onChange={(e) => handleInputChange(field.label, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              required={field.required}
              rows={4}
            />
            {errors[fieldId] && (
              <p className="text-red-500 text-sm">{errors[fieldId]}</p>
            )}
          </div>
        )

      case 'dropdown':
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleInputChange(field.label, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option, idx) => (
                  <SelectItem key={idx} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors[fieldId] && (
              <p className="text-red-500 text-sm">{errors[fieldId]}</p>
            )}
          </div>
        )

      case 'checkbox':
        return (
          <div key={fieldId} className="flex items-center space-x-2">
            <Checkbox
              id={fieldId}
              checked={value === true}
              onCheckedChange={(checked) => handleInputChange(field.label, checked)}
            />
            <Label htmlFor={fieldId} className="font-normal">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        )

      case 'date':
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="date"
              value={value}
              onChange={(e) => handleInputChange(field.label, e.target.value)}
              required={field.required}
            />
            {errors[fieldId] && (
              <p className="text-red-500 text-sm">{errors[fieldId]}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-500">
            No registration form available for this event yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {fields.map((field) => renderField(field))}
      <Button
        type="submit"
        className="w-full bg-[#00629B] hover:bg-[#004d7a]"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Registration'}
      </Button>
    </form>
  )
}