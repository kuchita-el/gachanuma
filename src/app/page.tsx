'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ForwardForm } from './_components/forward-form'
import { InverseForm } from './_components/inverse-form'

export default function Home() {
  return (
    <div className="mt-16">
      <Tabs defaultValue="forward">
        <TabsList>
          <TabsTrigger value="forward">順算</TabsTrigger>
          <TabsTrigger value="inverse">逆算</TabsTrigger>
        </TabsList>
        {/*
          タブを往復しても入力値と結果を保持する（Issue #10）。forceMount 時は Radix が hidden 属性を
          付けないため、非表示はクラスで指定する。
          状態を page に持ち上げる案は、useForm を2つ親に持たせることになり変更が大きいため採らない。
        */}
        <TabsContent value="forward" forceMount className="data-[state=inactive]:hidden">
          <ForwardForm />
        </TabsContent>
        <TabsContent value="inverse" forceMount className="data-[state=inactive]:hidden">
          <InverseForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}
