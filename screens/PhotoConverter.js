import React, { useState, useEffect } from 'react';
import { View, Button, Image, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export default function PhotoConverter() {
    const [image, setImage] = useState(null);
    const [name, setName] = useState('');
    const [musicXml, setMusicXml] = useState(null);

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Sorry, we need media library permissions to make this work!');
                }
            }
        })();
    }, []);

    const uploadImage = async (uri) => {
        if (!uri) {
            Alert.alert('No image selected!');
            return;
        }
    
        // Obtener el archivo desde el URI de la imagen
        const filename = uri.split('/').pop(); // Obtiene el nombre del archivo
        const fileType = 'image/jpeg'; // Define el tipo de archivo, cambia si es diferente
    
        try {
            const file = await fetch(uri);  // Obtener el archivo desde la URI
            const blob = await file.blob();  // Convertir a un Blob
    
            const formData = new FormData();
            formData.append('photo', blob, filename);  // Adjuntar el Blob al FormData
            formData.append('name', name);  // Adjuntar el Blob al FormData
    
            // Hacer la solicitud POST
            let response = await fetch('http://localhost:5000/upload/photo', {
                method: 'POST',
                body: formData,  // Enviar el FormData
                headers: {
                    Authorization: 'Bearer ' + localStorage.getItem('token'),  // Incluir el token de autenticación
                }
            });


    
            let result = await response.json();
            if (response.ok) {
                Alert.alert('Image uploaded successfully!');
                console.log('Upload result:', result);
                navigation.navigate("Conversions");
                //downloadMusicXml(result.musicXmlUrl);  // Descargar MusicXML
            } else {
                Alert.alert('Image upload failed!');
                console.log('Upload failed:', result);
            }
        } catch (error) {
            Alert.alert('An error occurred while uploading the image.');
            console.error('Upload error:', error);
        }
    };
    

    const downloadMusicXml = async (conversion_name) => {
        try {
            const response = await fetch('http://localhost:5000/uploads/conversions/' + conversion_name);
            if (response.ok) {
                setMusicXml(await response.text())
            }
            else {
                Alert.alert('Failed to download MusicXML file!');
                console.error('Download failed:', response);	
            }
        } catch (error) {
            Alert.alert('An error occurred while downloading the MusicXML file.');
            console.error('Download error:', error);
        }
    };

    const pickImage = async () => {
        let result;
        
        if (Platform.OS === 'web') {
            const inputElement = document.createElement('input');
            inputElement.type = 'file';
            inputElement.accept = 'image/*';
            inputElement.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const uri = URL.createObjectURL(file);
                    setImage(uri);
                    uploadImage(uri);
                }
            };
            inputElement.click();
        } else {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
            });

            console.log('Image picker result:', result);

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const uri = result.assets[0].uri;
                setImage(uri);
                uploadImage(uri);
            }
        }
    };

    const takePhoto = async () => {
        if (Platform.OS === 'web') {
            Alert.alert('Camera functionality is not supported on the web.');
            return;
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Sorry, we need camera permissions to make this work!');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        console.log('Camera result:', result);

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            setImage(uri);
            uploadImage(uri);
        }
    };

    return (
        <View style={styles.container}>
            <input type='text' placeholder='Enter your name' value={name} onChange={ev => setName(ev.target.value)} />
            <Button title="Pick an image from gallery" onPress={pickImage} />
            <Button title="Take a photo" onPress={takePhoto} />
            {image && <Image source={{ uri: image }} style={styles.image} />}
            {musicXml && <Button title="Open MusicXML" onPress={() => console.log('Open MusicXML file:', musicXml)} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: 200,
        height: 200,
        marginTop: 20,
    },
});
