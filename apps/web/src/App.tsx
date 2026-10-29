import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { IdentityProvider } from './app/identity.js'
import { LiveProvider } from './app/live.js'
import { MemberApp } from './app/MemberApp.js'
import { Picker } from './app/Picker.js'
import { Shell } from './app/Shell.js'
import { Agent } from './screens/Agent.js'
import { Family } from './screens/Family.js'
import { Home } from './screens/Home.js'

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
                  {({ me, s }) => (
                    <LiveProvider>
                      <Shell
                        me={me}
                        s={s}
                        screens={{
                          home: <Home me={me} s={s} />,
                          agent: <Agent me={me} s={s} />,
                          family: <Family s={s} />,
                        }}
                      />
                    </LiveProvider>
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
