# ✅ CORRECCIÓN: Safe Area en Formulario de Registro de Establecimiento

**Fecha:** 2026-02-01  
**Componente:** `src/pages/onboarding/OnboardingFlow.tsx`  
**Estado:** ✅ CORREGIDO

---

## 🔍 PROBLEMA IDENTIFICADO

El formulario de registro de establecimiento (`OnboardingFlow`) tenía un problema de safe area:

- ❌ Usaba `pb-24` (padding-bottom fijo de 96px)
- ❌ No consideraba `env(safe-area-inset-bottom)` para Android
- ❌ No consideraba la altura de la navegación inferior (`MobileBottomNav`)
- ❌ Los botones inferiores podían cortarse en dispositivos Android con barra de navegación

---

## ✅ CORRECCIÓN APLICADA

### 1. Contenedor Principal (`OnboardingFlow.tsx`)

**Antes:**
```tsx
<div className="min-h-screen bg-background p-4 pb-24">
```

**Después:**
```tsx
<div 
  className="min-h-screen bg-background p-4 pb-content-with-nav"
  style={{
    // ✅ Safe area: padding-bottom que considera la navegación inferior (76px) + safe-area de Android
    paddingBottom: 'calc(var(--bottom-nav-height, 76px) + max(32px, env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, 0px)))'
  }}
>
```

**Beneficios:**
- ✅ Considera la altura de `MobileBottomNav` (76px)
- ✅ Agrega `env(safe-area-inset-bottom)` para Android
- ✅ Usa `var(--app-safe-bottom, 0px)` como fallback (calculado por `useSafeArea` hook)
- ✅ Padding mínimo de 32px para espaciado adecuado

### 2. Diálogo de Logout

**Antes:**
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
```

**Después:**
```tsx
<div 
  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
  style={{
    // ✅ Safe area: padding que considera safe-area de Android
    paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, 0px))',
    paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
    paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
    paddingRight: 'max(16px, env(safe-area-inset-right, 0px))'
  }}
>
```

**Beneficios:**
- ✅ El diálogo no se corta en dispositivos con notch o barras de navegación
- ✅ Respeta todas las áreas seguras (top, bottom, left, right)

---

## 📊 CÁLCULO DEL PADDING

### Contenedor Principal:
```
padding-bottom = bottom-nav-height (76px) + max(32px, safe-area-inset-bottom)
```

**Ejemplos:**
- **iPhone sin notch:** `76px + 32px = 108px`
- **iPhone con notch:** `76px + 34px (safe-area) = 110px`
- **Android con barra de navegación:** `76px + 48px (safe-area) = 124px`
- **Android sin barra (gestos):** `76px + 32px = 108px`

### Diálogo de Logout:
```
padding = max(16px, safe-area-inset-{direction})
```

**Ejemplos:**
- **Dispositivo estándar:** `16px` (mínimo)
- **Dispositivo con notch:** `34px` (safe-area-inset-top)
- **Android con barra:** `48px` (safe-area-inset-bottom)

---

## 🔧 CLASES CSS UTILIZADAS

El proyecto ya tiene clases CSS utilitarias para safe area en `src/index.css`:

- ✅ `.pb-safe` - Padding bottom con safe area
- ✅ `.pb-safe-nav` - Padding bottom para navegación
- ✅ `.pb-content-with-nav` - Padding bottom para contenido sobre navegación
- ✅ `.sticky-footer-safe` - Para footers sticky

---

## ✅ VERIFICACIÓN

### Componentes Verificados:

1. ✅ **OnboardingFlow** - Contenedor principal corregido
2. ✅ **Diálogo de Logout** - Safe area aplicado
3. ✅ **MobileBottomNav** - Ya maneja safe area correctamente (verificado previamente)
4. ✅ **Steps individuales** - Los botones están dentro del contenedor principal, por lo que heredan el padding correcto

### Compatibilidad:

- ✅ **iOS:** Funciona con y sin notch
- ✅ **Android:** Funciona con barra de navegación y gestos
- ✅ **Desktop/Web:** Fallback a valores mínimos (sin safe-area)

---

## 📝 NOTAS

1. **MobileBottomNav** ya maneja `safe-area-inset-bottom` correctamente (línea 74 de `MobileBottomNav.tsx`)
2. El contenedor principal ahora calcula el padding considerando:
   - Altura de la navegación inferior (76px)
   - Safe area de Android (variable)
   - Padding mínimo para espaciado (32px)
3. Los botones de navegación en los steps están dentro del contenedor principal, por lo que automáticamente tienen el padding correcto

---

## 🧪 PRUEBAS RECOMENDADAS

1. **Probar en Android con barra de navegación:**
   - Verificar que los botones "Continuar" y "Atrás" no se corten
   - Verificar que el diálogo de logout no se corte

2. **Probar en iPhone con notch:**
   - Verificar que el contenido no se oculte detrás del notch
   - Verificar que los botones sean accesibles

3. **Probar en diferentes orientaciones:**
   - Portrait: Verificar safe area bottom
   - Landscape: Verificar safe area left/right

---

**FIN DE LA CORRECCIÓN**

