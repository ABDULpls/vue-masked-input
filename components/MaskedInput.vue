<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';

type Allowed = '0' | 'X'
const isMaskSlot = (char: string): char is Allowed => char === '0' || char === 'X';

interface Props {
    modelValue: string;
    mask: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'update:modelValue': [value: string]
    'focus': [event: FocusEvent]
    'blur': [event: FocusEvent]
    'keydown': [event: KeyboardEvent]
}>();

const inputRef = ref<HTMLInputElement>();
const lastCaret = ref<number | null>(null);
const internalCaretMaskPos = ref<number | null>(null);

const slots = computed(() => {
    const res: number[] = [];
    for (let i = 0; i < props.mask.length; i++) {
        if (isMaskSlot(props.mask[i])) res.push(i);
    }
    return res;
});

const formatViewValue = (cleanValue: string) => {
    let viewValue = '';
    let charIndex = 0;
    let lastFilledSlot = -1;
    let firstSlotPos = -1;

    for (let i = 0; i < props.mask.length; i++) {
        if (isMaskSlot(props.mask[i])) {
            firstSlotPos = i;
            break;
        }
    }

    for (let i = 0; i < props.mask.length; i++) {
        if (isMaskSlot(props.mask[i])) {
            if (charIndex < cleanValue.length) {
                lastFilledSlot = i;
                charIndex++;
            }
        }
    }

    charIndex = 0;

    for (let i = 0; i < props.mask.length; i++) {
        const m = props.mask[i];
        if (isMaskSlot(m)) {
            if (charIndex < cleanValue.length) {
                viewValue += cleanValue[charIndex];
                charIndex++;
            }
        } else {
            if ((i < firstSlotPos && m !== ' ') || (lastFilledSlot >= 0 && i < lastFilledSlot) || firstSlotPos === -1) {
                viewValue += m;
            }
        }
    }
    return viewValue;
};

const viewValue = computed(() => formatViewValue(props.modelValue || ''));

const formatWithMask = (cleanValue: string) => {
    let value = '';
    let charIndex = 0;
    for (let i = 0; i < props.mask.length; i++) {
        const maskChar = props.mask[i];
        if (isMaskSlot(maskChar)) {
            if (charIndex < cleanValue.length) {
                value += cleanValue[charIndex++];
            } else value += maskChar;
        } else {
            value += maskChar;
        }
    }
    return value;
};

const overlayValue = computed(() => formatWithMask(props.modelValue || ''));

const valueIndexFromMaskPosition = (maskPosition: number) => {
    let v = 0;
    for (let i = 0; i < maskPosition; i++) if (isMaskSlot(props.mask[i])) v++;
    return v;
};

const maskPositionFromValueIndex = (valueIndex: number) => {
    let passed = 0;
    for (let i = 0; i < props.mask.length; i++) {
        if (isMaskSlot(props.mask[i])) {
            if (passed === valueIndex) {
                return i;
            }
            passed++;
        }
    }
    return props.mask.length;
};

const nextSlotPosition = (maskPosition: number) => {
    for (let i = maskPosition + 1; i < props.mask.length; i++) {
        if (isMaskSlot(props.mask[i])) return i;
    }
    return props.mask.length;
};
const prevSlotPosition = (maskPosition: number) => {
    for (let i = maskPosition - 1; i >= 0; i--) {
        if (isMaskSlot(props.mask[i])) return i;
    }
    return 0;
};

const visiblePositionToValueIndex = (visiblePosition: number) => {
    return Math.min(visiblePosition, props.modelValue.length);
};

const valueIndexToVisiblePosition = (valueIndex: number) => {
    return Math.min(valueIndex, props.modelValue.length);
};

const maskPosToVisiblePos = (maskPos: number) => {
    let visibleIndex = 0;

    for (let i = 0; i < Math.min(maskPos, props.mask.length); i++) {
        const m = props.mask[i];
        if (isMaskSlot(m)) {
            if (visibleIndex < props.modelValue.length) {
                visibleIndex++;
            }
        } else {
            let firstSlotPos = -1;
            let lastFilledSlot = -1;

            for (let j = 0; j < props.mask.length; j++) {
                if (isMaskSlot(props.mask[j])) {
                    firstSlotPos = j;
                    break;
                }
            }

            let i = 0;
            for (let j = 0; j < props.mask.length; j++) {
                if (isMaskSlot(props.mask[j]) && i < props.modelValue.length) {
                    lastFilledSlot = j;
                    i++;
                }
            }

            if (i < firstSlotPos || (lastFilledSlot >= 0 && i < lastFilledSlot)) {
                visibleIndex++;
            }
        }
    }
    return visibleIndex;
};

const fitsMask = (slotChar: Allowed, char: string) => {
    if (slotChar === '0') {
        return /[0-9]/.test(char);
    }
    return /[^0-9]/.test(char);
};

const insertAt = (clean: string, startValueIdx: number, endValueIdx: number, text: string) => {
    let filtered = '';
    let ptr = startValueIdx;

    for (let i = 0; i < text.length && ptr < slots.value.length; i++) {
        const slotMaskPos = slots.value[ptr];
        const slotType = props.mask[slotMaskPos] as Allowed;
        const char = text[i];
        if (fitsMask(slotType, char)) {
            filtered += char;
            ptr++;
        }
    }

    const before = clean.slice(0, startValueIdx);
    const after = clean.slice(endValueIdx);
    const result = (before + filtered + after).slice(0, slots.value.length);
    const newValueIdx = startValueIdx + filtered.length;

    return {value: result, newValueIdx};
};

const setCaretByMaskPosition = (position: number) => {
    if (!inputRef.value) {
        return;
    }
    let maxPosition = Math.min(position, inputRef.value.value.length);

    if (props.modelValue.length === 0) {
        const firstSlotVisiblePos = maskPosToVisiblePos(nextSlotPosition(-1));
        maxPosition = Math.max(firstSlotVisiblePos, maxPosition);
    }

    inputRef.value.setSelectionRange(maxPosition, maxPosition);
    lastCaret.value = maxPosition;
};

const setCaretPosition = (pos: number) => {
    if (!inputRef.value) {
        return;
    }
    const maxPosition = Math.min(pos, inputRef.value.value.length);
    inputRef.value.setSelectionRange(maxPosition, maxPosition);
    lastCaret.value = maxPosition;
};

const filledLengthInMask = computed(() => {
    const valueLength = Math.min(props.modelValue.length, slots.value.length);
    if (valueLength === 0) {
        let i = 0;
        while (i < props.mask.length && !isMaskSlot(props.mask[i])) i++;
        return i;
    }
    const lastMaskPosition = slots.value[valueLength - 1];
    let endPosition = lastMaskPosition + 1;
    while (endPosition < props.mask.length && !isMaskSlot(props.mask[endPosition])) {
        if (props.mask[endPosition] === ' ') {
            break;
        }
        endPosition++;
    }
    return endPosition;
});
const leftPart = computed(() => overlayValue.value.slice(0, filledLengthInMask.value));
const rightPart = computed(() => overlayValue.value.slice(filledLengthInMask.value));

const onFocus = (e: FocusEvent) => {
    emit('focus', e);
    nextTick(() => {
        const pos = maskPositionFromValueIndex(props.modelValue.length);
        setCaretByMaskPosition(pos);
    });
};
const onBlur = (e: FocusEvent) => emit('blur', e);

const onKeyDown = (e: KeyboardEvent) => {
    emit('keydown', e);
    if (!inputRef.value) {
        return;
    }

    if (e.ctrlKey && ['v', 'a', 'c', 'x', 'z'].includes(e.key.toLowerCase())) {
        return;
    }

    const selStart = inputRef.value.selectionStart ?? 0;
    const selEnd = inputRef.value.selectionEnd ?? selStart;

    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const pos = Math.max(0, selStart - 1);
        setCaretPosition(pos);
        return;
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        const pos = Math.min(selStart + 1, inputRef.value.value.length);
        setCaretPosition(pos);
        return;
    }
    if (e.key === 'Home') {
        e.preventDefault();
        const first = nextSlotPosition(-1);
        setCaretByMaskPosition(first);
        return;
    }
    if (e.key === 'End') {
        e.preventDefault();
        const pos = maskPositionFromValueIndex(props.modelValue.length);
        setCaretByMaskPosition(pos);
        return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const hasSelection = selEnd > selStart;
        let startValueIdx: number;
        let endValueIdx: number;
        let caretMaskPos: number;

        if (hasSelection) {
            startValueIdx = valueIndexFromMaskPosition(selStart);
            endValueIdx = valueIndexFromMaskPosition(selEnd);
            caretMaskPos = selStart;
        } else {
            if (e.key === 'Backspace') {
                const firstSlotVisiblePos = maskPosToVisiblePos(nextSlotPosition(-1));
                if (selStart <= firstSlotVisiblePos) {
                    if (props.modelValue.length > 0) {
                        caretMaskPos = selStart;
                        startValueIdx = 0;
                        endValueIdx = 0;
                    } else {
                        caretMaskPos = Math.max(0, selStart - 1);
                        startValueIdx = 0;
                        endValueIdx = 0;
                    }
                } else {
                    const targetMaskPos = prevSlotPosition(selStart);
                    const vi = valueIndexFromMaskPosition(targetMaskPos);
                    startValueIdx = vi;
                    endValueIdx = vi + 1;
                    caretMaskPos = selStart - 1;
                }
            } else {
                const currentChar = props.mask[selStart];
                const targetMaskPos = isMaskSlot(currentChar) ? selStart : nextSlotPosition(selStart - 1);
                const vi = valueIndexFromMaskPosition(targetMaskPos);
                startValueIdx = vi;
                endValueIdx = vi + 1;
                caretMaskPos = selStart;
            }
        }

        const {value} = insertAt(props.modelValue, startValueIdx, endValueIdx, '');
        internalCaretMaskPos.value = caretMaskPos;
        emit('update:modelValue', value);
        nextTick(() => {
            const cm = internalCaretMaskPos.value;
            if (cm !== null) {
                setCaretByMaskPosition(cm);
            }
        });
        return;
    }

    if (e.key.length === 1) {
        e.preventDefault();
        const posMaskChar = props.mask[selStart];
        const slotPos = isMaskSlot(posMaskChar) ? selStart : nextSlotPosition(selStart - 1);
        const newStartValueIdx = valueIndexFromMaskPosition(slotPos);
        const endValueIdx = valueIndexFromMaskPosition(selEnd);

        if (slotPos < props.mask.length) {
            const slotType = props.mask[slotPos] as Allowed;
            if (fitsMask(slotType, e.key)) {
                const {value} = insertAt(props.modelValue, newStartValueIdx, endValueIdx, e.key);
                const nextPos = nextSlotPosition(slotPos);
                internalCaretMaskPos.value = nextPos < props.mask.length ? nextPos : props.mask.length;
                emit('update:modelValue', value);
                nextTick(() => {
                    const position = internalCaretMaskPos.value;
                    if (position !== null) {
                        setCaretByMaskPosition(position);
                    }
                });
            } else {
            }
        }
    }
};

const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    if (!inputRef.value) {
        return;
    }
    const maskPrefixLastIdx = props.mask.split('').findIndex(char => isMaskSlot(char));
    const maskPrefix = props.mask.substring(0, Math.max(0, maskPrefixLastIdx - 1));

    let text = e.clipboardData?.getData('text') ?? '';
    if (text.startsWith(maskPrefix)) {
        text = text.substring(maskPrefixLastIdx);
    }


    const selStart = inputRef.value.selectionStart ?? 0;
    const selEnd = inputRef.value.selectionEnd ?? selStart;

    const startValueIdx = visiblePositionToValueIndex(selStart);
    const endValueIdx = visiblePositionToValueIndex(selEnd);


    const {value, newValueIdx} = insertAt(props.modelValue, startValueIdx, endValueIdx, text);

    const newVisiblePos = valueIndexToVisiblePosition(newValueIdx);
    internalCaretMaskPos.value = newVisiblePos;

    emit('update:modelValue', value);
    nextTick(() => setCaretByMaskPosition(internalCaretMaskPos.value ?? newVisiblePos));
};

watch(() => props.modelValue, () => {
    nextTick(() => {
        if (!inputRef.value) {
            return;
        }
        if (internalCaretMaskPos.value !== null) {
            setCaretByMaskPosition(internalCaretMaskPos.value);
            internalCaretMaskPos.value = null;
            return;
        }
        const maskPos = maskPositionFromValueIndex(props.modelValue.length);
        const visiblePos = maskPosToVisiblePos(maskPos);
        setCaretByMaskPosition(visiblePos);
    });
});

onMounted(() => {
    if (!inputRef.value) {
        return;
    }
    const maskPos = maskPositionFromValueIndex(props.modelValue.length);
    const visiblePos = maskPosToVisiblePos(maskPos);
    setCaretByMaskPosition(visiblePos);
});
</script>

<template>
    <div class="masked-input-container">
        <input
            ref="inputRef"
            class="masked-input-field"
            :value="viewValue"
            @focus="onFocus"
            @blur="onBlur"
            @keydown="onKeyDown"
            @paste="onPaste"
            autocomplete="off"
            spellcheck="false"
        />
        <div class="masked-input-overlay">
            <span class="masked-input-filled">{{ leftPart }}</span>
            <span class="masked-input-rest">{{ rightPart }}</span>
        </div>
    </div>
</template>

<style>
.masked-input-container {
    position: relative;
    display: inline-block;
    width: 100%;
}

.masked-input-field {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
    background: transparent;
    color: transparent;
    caret-color: #000;
    outline: none;
    z-index: 2;
    position: relative;
}

.masked-input-field:focus {
    border-color: cornflowerblue;
}

.masked-input-overlay {
    position: absolute;
    inset: 0;
    padding: 8px 12px;
    font-size: 16px;
    line-height: 1.5;
    pointer-events: none;
    z-index: 1;
    display: flex;
    align-items: center;
    white-space: pre;
}

.masked-input-filled {
    color: #000;
}

.masked-input-rest {
    color: #999;
}
</style>
