import React from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "../styles/ConversionsScreenStyle";
import AuthImage from "../components/AuthImage";
import GradientBackground from "../components/GradientBackground";
import AnimatedEntrance from "../components/AnimatedEntrance";

export default function ConversionsScreenView({
  conversions,
  selectedImage,
  loadingImage,
  handleImagePress,
  closeModal,
  downloadFile,
  handleLoadStart,
  handleLoadEnd,
  handleError,
  imageSource,
  onDeleteSheet,
  onReorder,
}) {
  const { width } = useWindowDimensions();
  const numColumns = width < 700 ? 1 : width < 1060 ? 2 : 3;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 6,
      },
    })
  );

  const handleWebDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = conversions.findIndex((c) => c.sheet_key === active.id);
    const newIndex = conversions.findIndex((c) => c.sheet_key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(conversions, oldIndex, newIndex));
  };

  const renderCardContent = (item, drag, isActive, isWeb = false) => (
    <View style={isActive ? styles.cardActive : null}>
      <View style={styles.cardTopBar}>
        <TouchableOpacity style={styles.dragHandle} onLongPress={drag} delayLongPress={120}>
          <Text style={styles.dragHandleText}>:::</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            if (isWeb) {
              e?.stopPropagation?.();
              e?.preventDefault?.();
            }
            onDeleteSheet(item);
          }}
           onPressIn={(e) => {
             e?.stopPropagation?.();
           }}
        >
          <Text style={styles.deleteButtonText}>x</Text>
        </TouchableOpacity>
      </View>
      {item.type === "audio" ? (
        <View style={styles.audioIconContainer}>
          <Text style={styles.audioIcon}>🎵</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.image}
          onPress={() => handleImagePress(`/uploads/sheets/${item.filename}`)}
        >
          <AuthImage path={`/uploads/sheets/${item.filename}`} style={styles.image} />
        </TouchableOpacity>
      )}
      <Text style={styles.cardTitle}>
        {item.name ? item.name : item.filename}
      </Text>
      <View style={styles.buttonContainer}>
        {item.type === "audio" && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => downloadFile(item.audio, "AUDIO")}
          >
            <Text style={styles.buttonText}>Descargar Audio</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => downloadFile(item.musicxml, "MXL")}
        >
          <Text style={styles.buttonText}>Descargar XML</Text>
        </TouchableOpacity>
        {item.omr && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => downloadFile(item.omr, "OMR")}
          >
            <Text style={styles.buttonText}>Descargar OMR</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderItem = ({ item, drag, isActive }) => (
    <Pressable
      style={[
        styles.card,
        numColumns === 1 ? styles.cardSingle : null,
        numColumns === 2 ? styles.cardCompact : null,
      ]}
      onLongPress={drag}
      delayLongPress={120}
    >
      {renderCardContent(item, drag, isActive)}
    </Pressable>
  );

  const WebSortableItem = ({ item }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.sheet_key,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.65 : 1,
      cursor: "grab",
      touchAction: "none",
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <View style={[styles.card, styles.cardWebGrid]}>{renderCardContent(item, null, isDragging, true)}</View>
      </div>
    );
  };

  return (
    <GradientBackground>
      <View style={styles.container}>
        <AnimatedEntrance delay={60}>
          <Text style={styles.title}>Partituras Convertidas</Text>
          {Platform.OS === "web" ? (
            <>
              {conversions.length === 0 ? (
                <Text style={styles.emptyText}>No hay partituras convertidas.</Text>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWebDragEnd}>
                  <SortableContext
                    items={conversions.map((item) => item.sheet_key)}
                    strategy={rectSortingStrategy}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`,
                        gap: "12px",
                        width: "100%",
                      }}
                    >
                      {conversions.map((item) => (
                        <WebSortableItem key={item.sheet_key} item={item} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          ) : (
            <DraggableFlatList
              data={conversions}
              key={`${numColumns}-cols`}
              keyExtractor={(item) => item.sheet_key}
              renderItem={renderItem}
              onDragEnd={({ data }) => onReorder(data)}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
              activationDistance={4}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No hay partituras convertidas.</Text>
              }
              contentContainerStyle={{
                paddingBottom: 100,
                flexGrow: 1,
              }}
              scrollEnabled={conversions.length > 0}
              showsVerticalScrollIndicator={true}
            />
          )}
        </AnimatedEntrance>
        <Modal visible={!!selectedImage} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
              <Text style={styles.modalCloseText}>x</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBackground}
              onPress={closeModal}
              activeOpacity={1}
            >
              {selectedImage &&
                typeof selectedImage === "string" &&
                selectedImage.trim() !== "" && (
                  <>
                    {imageSource && (
                      <Image
                        style={styles.modalImage}
                        source={imageSource}
                        onLoadStart={handleLoadStart}
                        onLoadEnd={handleLoadEnd}
                        onError={handleError}
                      />
                    )}
                    {loadingImage && (
                      <ActivityIndicator
                        size="large"
                        color="#fff"
                        style={styles.activityIndicator}
                      />
                    )}
                  </>
                )}
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </GradientBackground>
  );
}
