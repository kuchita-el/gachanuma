'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ForwardForm } from './_components/forward-form'
import { InverseForm } from './_components/inverse-form'

export default function Home() {
  return (
    <div className="mt-6 mb-12">
      <p className="text-muted-foreground text-sm">
        ガチャなどの成功率から、目標の確率で成功するまでに必要な回数や、決まった回数で成功する確率を計算します。
      </p>
      <Tabs defaultValue="forward" className="mt-4">
        {/*
          ui/ 本体は変更せず、利用箇所で上書きする（Issue #20）。shadcn の再生成時に差分が出ないようにするため。
          高さは ui/ 側が group-data-horizontal バリアントで指定しているため、同じバリアントで上書きする。
          TabsList の内側の余白（上下 3px）を引いても、各タブが 44px 以上になる高さにする。
        */}
        <TabsList className="w-full group-data-horizontal/tabs:h-13">
          <TabsTrigger value="forward" className="text-base">必要な回数</TabsTrigger>
          <TabsTrigger value="inverse" className="text-base">成功する確率</TabsTrigger>
        </TabsList>
        {/*
          タブを往復しても入力値と結果を保持する（Issue #10）。forceMount 時は Radix が hidden 属性を
          付けないため、非表示はクラスで指定する。
          状態を page に持ち上げる案は、useForm を2つ親に持たせることになり変更が大きいため採らない。
        */}
        <TabsContent value="forward" forceMount className="mt-4 data-[state=inactive]:hidden">
          <ForwardForm />
        </TabsContent>
        <TabsContent value="inverse" forceMount className="mt-4 data-[state=inactive]:hidden">
          <InverseForm />
        </TabsContent>
      </Tabs>

      {/* 依存を増やさないため、Accordion ではなくネイティブの details を使う（Issue #18） */}
      <details className="mt-10 rounded-lg border px-4 text-sm">
        {/* flex にすると開閉の三角マーカーが消えるため、高さは padding で確保する */}
        <summary className="cursor-pointer py-3 font-medium">
          計算の前提
        </summary>
        <ul className="mb-4 list-disc space-y-2 pl-5">
          <li>各試行は互いに独立で、成功率は毎回同じとして計算します。</li>
          <li>
            「信頼度」は、求めた回数以内に目標を達成できる確率です。たとえば信頼度 90% の結果が 230 回なら、230 回以内に目標を達成できる確率が 90% です。
          </li>
          <li>
            「天井」は、天井回数目の試行で目的のものが確定する仕組みとして計算します。ただし「天井すり抜け率」の確率で外れます。
          </li>
          <li>
            天井すり抜け率 0% は天井で必ず成功、100% は天井の回で必ず外れる（天井の効果がない）として計算します。
          </li>
          <li>天井を考慮する計算は、1回成功する場合のみに対応しています。天井で外れた後の、2回目の天井は考慮しません。</li>
        </ul>
      </details>
    </div>
  )
}
