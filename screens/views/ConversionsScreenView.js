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
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "../styles/ConversionsScreenStyle";
import { apiUrl } from "../../lib/api";
import GradientBackground from "../components/GradientBackground";
import AnimatedEntrance from "../components/AnimatedEntrance";

const stopPointerDown = (e) => e.stopPropagation();

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
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const handleWebDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = conversions.findIndex((c) => c.sheet_key === active.id);
    const newIndex = conversions.findIndex((c) => c.sheet_key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(conversions, oldIndex, newIndex));
  };

  const renderCardContent = (item, drag, isActive) => (
    <View style={isActive ? styles.cardActive : null}>
      <View style={styles.cardTopBar}>
        {Platform.OS === "web" ? (
          <div onPointerDown={stopPointerDown} style={{ display: "contents" }}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDeleteSheet(item)}
            >
              <Text style={styles.deleteButtonText}>x</Text>
            </TouchableOpacity>
          </div>
        ) : (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDeleteSheet(item)}
          >
            <Text style={styles.deleteButtonText}>x</Text>
          </TouchableOpacity>
        )}
      </View>
      {item.type === "audio" ? (
        <View style={styles.audioIconContainer}>
          <Text style={styles.audioIcon}>🎵</Text>
        </View>
      ) : item.filename?.toLowerCase().endsWith(".pdf") ? (
        <View style={styles.audioIconContainer}>
          <Text style={styles.audioIcon}>📄</Text>
        </View>
      ) : Platform.OS === "web" ? (
        <div onPointerDown={stopPointerDown} style={{ display: "contents" }}>
          <TouchableOpacity
            style={styles.image}
            onPress={() => handleImagePress(apiUrl(`/uploads/sheets/${item.filename}`))}
          >
            <Image
              source={{ uri: apiUrl(`/uploads/sheets/${item.filename}`) }}
              style={styles.image}
              onError={(error) =>
                console.error("Error al cargar la imagen:", error.nativeEvent.error)
              }
            />
          </TouchableOpacity>
        </div>
      ) : (
        <TouchableOpacity
          style={styles.image}
          onPress={() => handleImagePress(apiUrl(`/uploads/sheets/${item.filename}`))}
        >
          <Image
            source={{ uri: apiUrl(`/uploads/sheets/${item.filename}`) }}
            style={styles.image}
            onError={(error) =>
              console.error("Error al cargar la imagen:", error.nativeEvent.error)
            }
          />
        </TouchableOpacity>
      )}
      <Text style={styles.cardTitle}>
        {item.name ? item.name : item.filename}
      </Text>
      <View style={styles.buttonContainer}>
        {Platform.OS === "web" ? (
          <div onPointerDown={stopPointerDown} style={{ display: "contents" }}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => downloadFile(item.musicxml)}
            >
              <Text style={styles.buttonText}>Descargar XML</Text>
            </TouchableOpacity>
          </div>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={() => downloadFile(item.musicxml)}
          >
            <Text style={styles.buttonText}>Descargar XML</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderItem = ({ item, drag, isActive }) => (
    <ScaleDecorator>
      <Pressable
        style={[
          styles.card,
          numColumns === 1 ? styles.cardSingle : null,
          numColumns === 2 ? styles.cardCompact : null,
        ]}
        onLongPress={drag}
        delayLongPress={120}
        disabled={isActive}
      >
        {renderCardContent(item, drag, isActive)}
      </Pressable>
    </ScaleDecorator>
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
        <View style={[styles.card, styles.cardWebGrid]}>{renderCardContent(item, null, isDragging)}</View>
      </div>
    );
  };

  return (
    <GradientBackground>
      <View style={styles.container}>
        {Platform.OS === "web" ? (
          <div style={{ height: "calc(100vh - 120px)", overflowY: "auto", paddingBottom: 100 }}>
            <AnimatedEntrance delay={60}>
              <Text style={styles.title}>Partituras Convertidas</Text>
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
            </AnimatedEntrance>
          </div>
        ) : (
          <AnimatedEntrance delay={60} style={{ flex: 1 }}>
            <DraggableFlatList
              data={conversions}
              key={`${numColumns}-cols`}
              keyExtractor={(item) => item.sheet_key}
              renderItem={renderItem}
              onDragEnd={({ data }) => onReorder(data)}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
              activationDistance={4}
              ListHeaderComponent={<Text style={styles.title}>Partituras Convertidas</Text>}
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
          </AnimatedEntrance>
        )}
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
                    <Image
                      style={styles.modalImage}
                      source={imageSource}
                      onLoadStart={handleLoadStart}
                      onLoadEnd={handleLoadEnd}
                      onError={handleError}
                    />
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
