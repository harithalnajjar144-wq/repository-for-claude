import { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { fileUrl } from "@/lib/api";
import { colors } from "@/lib/theme";
import { Thumb } from "./cards";
import { T } from "./ui";

export function Gallery({ images, category }: { images: string[]; category: string }) {
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const h = Math.round(width * 0.75);
  if (!images.length) return <Thumb category={category} height={h} rounded={false} />;
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width))}
      >
        {images.map((u) => (
          <Image alt="" key={u} source={{ uri: fileUrl(u) }} style={{ width, height: h, backgroundColor: colors.earth100 }} contentFit="cover" />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={{ position: "absolute", bottom: 10, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 99, paddingHorizontal: 10 }}>
          <T size={12} color={colors.white}>
            {i + 1} / {images.length}
          </T>
        </View>
      )}
    </View>
  );
}
