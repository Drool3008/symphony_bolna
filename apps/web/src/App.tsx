import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { IdentityProvider } from './app/identity.js'
import { MemberApp } from './app/MemberApp.js'
import { Picker } from './app/Picker.js'

export function App() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/pick" element={<Picker />} />
            <Route
              path="*"
              element={
                <MemberApp>
                  {({ me }) => (
                    <main>
                      <h1>{me.name}</h1>
                    </main>
                  )}
                </MemberApp>
              }
            />
          </Routes>
        </BrowserRouter>
      </IdentityProvider>
    </QueryClientProvider>
  )
}
