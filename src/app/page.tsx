'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ForwardForm } from './_forward-form'
import { InverseForm } from './_inverse-form'

export default function Home() {
  return (
    <div className="mt-16">
      <Tabs defaultValue="forward">
        <TabsList>
          <TabsTrigger value="forward">順算</TabsTrigger>
          <TabsTrigger value="inverse">逆算</TabsTrigger>
        </TabsList>
        <TabsContent value="forward">
          <ForwardForm />
        </TabsContent>
        <TabsContent value="inverse">
          <InverseForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}
