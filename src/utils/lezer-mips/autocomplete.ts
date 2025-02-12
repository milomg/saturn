import { CompletionContext } from '@codemirror/autocomplete'
import { suggestions } from './suggestions'
import { SuggestionType } from '../languages/suggestions'

export function myCompletions(context: CompletionContext) {
  let word = context.matchBefore(/[a-zA-Z$._]*/)!
  if (word.from == word.to && !context.explicit) return null
  if (word.text.startsWith('$')) {
    return {
      from: word.from,
      options: [
        { detail: 'Zero Register', label: '$zero' },
        { detail: 'Assembler Temporary', label: '$at' },
        { detail: 'Value 0', label: '$v0' },
        { detail: 'Value 1', label: '$v1' },
        { detail: 'Parameter 0', label: '$a0' },
        { detail: 'Parameter 1', label: '$a1' },
        { detail: 'Parameter 2', label: '$a2' },
        { detail: 'Parameter 3', label: '$a3' },
        { detail: 'Temporary 0', label: '$t0' },
        { detail: 'Temporary 1', label: '$t1' },
        { detail: 'Temporary 2', label: '$t2' },
        { detail: 'Temporary 3', label: '$t3' },
        { detail: 'Temporary 4', label: '$t4' },
        { detail: 'Temporary 5', label: '$t5' },
        { detail: 'Temporary 6', label: '$t6' },
        { detail: 'Temporary 7', label: '$t7' },
        { detail: 'Saved 0', label: '$s0' },
        { detail: 'Saved 1', label: '$s1' },
        { detail: 'Saved 2', label: '$s2' },
        { detail: 'Saved 3', label: '$s3' },
        { detail: 'Saved 4', label: '$s4' },
        { detail: 'Saved 5', label: '$s5' },
        { detail: 'Saved 6', label: '$s6' },
        { detail: 'Saved 7', label: '$s7' },
        { detail: 'Temporary 8', label: '$t8' },
        { detail: 'Temporary 9', label: '$t9' },
        { detail: 'Kernel 0', label: '$k0' },
        { detail: 'Kernel 1', label: '$k1' },
        { detail: 'General Pointer', label: '$gp' },
        { detail: 'Stack Pointer', label: '$sp' },
        { detail: 'Frame Pointer', label: '$fp' },
        { detail: 'Return Address', label: '$ra' },
      ].map((x) => ({ ...x, type: 'register' })),
    }
  }

  let labels: { detail: string; label: string; type: string | undefined }[] = []

  const suggestionsContext = context.view?.state.field(suggestions)

  if (suggestionsContext) {
    const iter = suggestionsContext.iter()

    while (iter.value) {
      const suggestion = iter.value.suggestion

      labels.push({
        detail: suggestion.name ?? suggestion.replace,
        label: suggestion.replace,
        type: (() => {
          switch (suggestion.type) {
            case SuggestionType.Label:
              return 'label' // ?
            case SuggestionType.Function:
              return 'function'
            case SuggestionType.Variable:
              return 'constant'
            default:
              return undefined
          }
        })(),
      })

      iter.next()
    }
  }

  return {
    from: word.from,
    options: [
      ...[
        { detail: 'Ascii Text', label: '.ascii' },
        { detail: 'Ascii Zero Terminated', label: '.asciiz' },
        { detail: 'Align Bytes', label: '.align' },
        { detail: 'Space Bytes', label: '.space' },
        { detail: 'Byte Literals', label: '.byte' },
        { detail: 'Half Literals', label: '.half' },
        { detail: 'Word Literals', label: '.word' },
        { detail: 'Float Literals', label: '.float' },
        { detail: 'Double Literals', label: '.double' },
        { detail: 'Entry Point', label: '.entry' },
        { detail: 'Text Section', label: '.text' },
        { detail: 'Data Section', label: '.data' },
        { detail: 'Kernel Text Section', label: '.ktext' },
        { detail: 'Kernel Data Section', label: '.kdata' },
        { detail: 'Extern Symbol', label: '.extern' },
        { detail: 'Define Token', label: '.eqv' },
        { detail: 'Define Macro', label: '.macro' },
        { detail: 'End Macro', label: '.end_macro' },
        { detail: 'Include Source', label: '.include' },
      ].map((x) => ({ ...x, type: 'data' as string | undefined })),
      ...[
        { detail: 'Shift Left', label: 'sll' },
        { detail: 'Shift Right', label: 'srl' },
        { detail: 'Shift Right Signed', label: 'sra' },
        { detail: 'Shift Left Reg', label: 'sllv' },
        { detail: 'Shift Right Reg', label: 'srlv' },
        { detail: 'Shift Right Signed Reg', label: 'srav' },
        { detail: 'Jump Register', label: 'jr' },
        { detail: 'Jump and Link Register', label: 'jalr' },
        { detail: 'Move From HI', label: 'mfhi' },
        { detail: 'Move To HI', label: 'mthi' },
        { detail: 'Move From LO', label: 'mflo' },
        { detail: 'Move To LO', label: 'mtlo' },
        { detail: 'Multiply', label: 'mult' },
        { detail: 'Multiply Unsigned', label: 'multu' },
        { detail: 'Divide', label: 'div' },
        { detail: 'Divide Unsigned', label: 'divu' },
        { detail: 'Add', label: 'add' },
        { detail: 'Add Unsigned', label: 'addu' },
        { detail: 'Subtract', label: 'sub' },
        { detail: 'Subtract Unsigned', label: 'subu' },
        { detail: 'Bitwise AND', label: 'and' },
        { detail: 'Bitwise OR', label: 'or' },
        { detail: 'Bitwise XOR', label: 'xor' },
        { detail: 'Bitwise NOR', label: 'nor' },
        { detail: 'Set Less Than', label: 'slt' },
        { detail: 'Set Less or Equal', label: 'sle' },
        { detail: 'Set Greater or Equal', label: 'sge' },
        { detail: 'Set Greater Than', label: 'sgt' },
        { detail: 'Set < Unsigned', label: 'sltu' },
        { detail: 'Set <= Unsigned', label: 'sleu' },
        { detail: 'Set >= Unsigned', label: 'sgeu' },
        { detail: 'Set > Unsigned', label: 'sgtu' },
        { detail: 'Set Equal', label: 'seq' },
        { detail: 'Set Not Equal', label: 'sne' },
        { detail: 'Branch < 0', label: 'bltz' },
        { detail: 'Branch >= 0', label: 'bgez' },
        { detail: 'Branch < 0 and Link', label: 'bltzal' },
        { detail: 'Branch >= 0 and Link', label: 'bgezal' },
        { detail: 'Jump', label: 'j' },
        { detail: 'Jump and Link', label: 'jal' },
        { detail: 'Branch Equal', label: 'beq' },
        { detail: 'Branch Not Equal', label: 'bne' },
        { detail: 'Branch <= 0', label: 'blez' },
        { detail: 'Branch > 0', label: 'bgtz' },
        { detail: 'Add Immediate', label: 'addi' },
        { detail: 'Add Immediate Unsigned', label: 'addiu' },
        { detail: 'Set < Immediate', label: 'slti' },
        { detail: 'Set < Immediate Unsigned', label: 'sltiu' },
        { detail: 'Bitwise AND Immediate', label: 'andi' },
        { detail: 'Bitwise OR Immediate', label: 'ori' },
        { detail: 'Bitwise XOR Immediate', label: 'xori' },
        { detail: 'Load Upper Immediate', label: 'lui' },
        { detail: 'Load LO', label: 'llo' },
        { detail: 'Load HI', label: 'lhi' },
        { detail: 'Trap Exeption', label: 'trap' },
        { detail: 'System Call', label: 'syscall' },
        { detail: 'Load Byte', label: 'lb' },
        { detail: 'Load Half', label: 'lh' },
        { detail: 'Load Word', label: 'lw' },
        { detail: 'Load Byte Unsigned', label: 'lbu' },
        { detail: 'Load Half Unsigned', label: 'lhu' },
        { detail: 'Store Byte', label: 'sb' },
        { detail: 'Store Half', label: 'sh' },
        { detail: 'Store Word', label: 'sw' },
        { detail: 'Multiply and Add', label: 'madd' },
        { detail: 'Multiply and Add Unsigned', label: 'maddu' },
        { detail: 'Multiply Registers', label: 'mul' },
        { detail: 'Multiply and Subtract', label: 'msub' },
        { detail: 'Multiply and Subtract Unsigned', label: 'msubu' },
        { detail: 'Absolute Value', label: 'abs' },
        { detail: 'Branch Less Than', label: 'blt' },
        { detail: 'Branch Greater Than', label: 'bgt' },
        { detail: 'Branch Less or Equal', label: 'ble' },
        { detail: 'Branch Greater or Equal', label: 'bge' },
        { detail: 'Branch < Unsigned', label: 'bltu' },
        { detail: 'Branch > Unsigned', label: 'bgtu' },
        { detail: 'Branch <= Unsigned', label: 'bleu' },
        { detail: 'Branch >= Unsigned', label: 'bgeu' },
        { detail: 'Negate Value', label: 'neg' },
        { detail: 'Negate Unsigned Value', label: 'negu' },
        { detail: 'Bitwise NOT', label: 'not' },
        { detail: 'Load Immediate', label: 'li' },
        { detail: 'Load Address', label: 'la' },
        { detail: 'Move Registers', label: 'move' },
        { detail: 'Branch', label: 'b' },
        { detail: 'Subtract Immediate', label: 'subi' },
        { detail: 'Subtract Immediate Unsigned', label: 'subiu' },
      ].map((x) => ({ ...x, type: 'instruction' })),
      ...labels,
    ],
  }
}
