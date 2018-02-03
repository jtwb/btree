const n = 256;
const buffer = new ArrayBuffer(n);
const int32view = new Int32Array(buffer);

for (let i = 0; i < int32view.length; i ++) {
    int32view[i] = i;
}

for (let i = 0; i < int32view.length; i ++) {
    console.log(int32view[i]);
}
