import { defineConfig } from 'vite';
export default defineConfig({base:'./',server:{host:'0.0.0.0',port:4173,strictPort:true},build:{target:'es2022'}});
