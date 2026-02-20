import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import styles from "../styles/ConversionsScreenStyle";
import { SafeAreaView } from "react-native-web";

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
}) {
    const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.type === "audio" ? (
        <View style={styles.audioIconContainer}>
          <Text style={styles.audioIcon}>🎵</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.image}
          onPress={() =>
            handleImagePress(
              `http://192.168.1.13:5000/uploads/sheets/${item.filename}`
            )
          }
        >
          <Image
            source={{
              uri: `http://192.168.1.13:5000/uploads/sheets/${item.filename}`,
            }}
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

  
  return (
    <View style={styles.container}>
        <Text style={styles.title}>Partituras Convertidas</Text>
        <FlatList
          data={conversions}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay partituras convertidas.</Text>
          }
          contentContainerStyle={{
            paddingBottom: 100,
            flexGrow: 1,
          }}
//          style={{flexGrow: 0, flexShrink: 1, width: "100%"}}
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
        />
        <Modal visible={!!selectedImage} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
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
  );
}
