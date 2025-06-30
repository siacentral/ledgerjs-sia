// TODO: add tests

test('hex', () => {
    expect(Buffer.from([0x01, 0x02, 0x03, 0x04]).toString('hex')).toBe('01020304');
    expect(Buffer.from([0xff, 0x00, 0x7f, 0x80]).toString('hex')).toBe('ff007f80');
    expect(Buffer.from([128, 159, 25, 248, 99, 203, 72, 17, 98, 253, 23, 180, 224, 222, 26, 70, 201, 129, 231, 39, 56, 91, 210, 31, 17, 189, 108, 244, 211, 213, 45, 111]).toString('hex')).toBe('809f19f863cb481162fd17b4e0de1a46c981e727385bd21f11bd6cf4d3d52d6f');
});

test('subarray', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    const sub = buf.subarray(0, -2);
    expect(sub.toString('hex')).toBe('010203');
    expect(sub.length).toBe(3);
});