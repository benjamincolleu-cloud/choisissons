import { supabase } from '../supabaseClient'

// ── Internal helpers ───────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

function getEthereum(): EthProvider {
  const eth = (window as unknown as { ethereum?: EthProvider }).ethereum
  if (!eth) {
    throw new Error(
      'MetaMask non détecté. Installez MetaMask pour ancrer sur Ethereum.'
    )
  }
  return eth
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Fetches all bulletins for a proposal from urne_electronique,
 * concatenates their proof_hashes in insertion order, and
 * returns the SHA-256 of the concatenation — the root hash of the urn.
 *
 * If no votes have been cast yet, falls back to hashing the proposalId
 * so the function always returns a deterministic value.
 */
export async function computeUrneRootHash(proposalId: string): Promise<string> {
  const { data, error } = await supabase
    .from('urne_electronique')
    .select('proof_hash')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Impossible de lire l'urne : ${error.message}`)

  const hashes = (data as { proof_hash: string }[]).map(r => r.proof_hash)
  const concatenated = hashes.length > 0 ? hashes.join('') : proposalId
  return sha256(concatenated)
}

/**
 * Anchors a hash on the Ethereum Sepolia testnet via MetaMask.
 *
 * Sends a zero-value self-transaction whose `data` field contains the
 * UTF-8 encoded payload:  "choisissons:<proposalId>:<rootHash>"
 *
 * The transaction is free (only requires a small amount of testnet gas).
 * Free Sepolia ETH faucets: https://sepoliafaucet.com · https://faucet.sepolia.dev
 *
 * Returns the Etherscan URL so any citizen can verify the anchor.
 */
export async function anchorHash(
  proposalId: string,
  rootHash: string
): Promise<string> {
  const eth = getEthereum()

  // Request wallet access
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts || accounts.length === 0) {
    throw new Error('Aucun compte MetaMask disponible.')
  }
  const from = accounts[0]

  // Switch to Sepolia testnet (chainId 11155111 = 0xaa36a7)
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa36a7' }],
    })
  } catch {
    // Chain not in wallet — add it automatically
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: '0xaa36a7',
          chainName: 'Sepolia Testnet',
          rpcUrls: ['https://rpc.sepolia.org'],
          nativeCurrency: { name: 'SepoliaETH', symbol: 'SEP', decimals: 18 },
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        },
      ],
    })
  }

  // Encode payload as UTF-8 hex
  const payload = `choisissons:${proposalId}:${rootHash}`
  const hexData =
    '0x' +
    Array.from(new TextEncoder().encode(payload))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

  // Zero-value self-transaction — data field carries the proof
  const txHash = (await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: from, value: '0x0', data: hexData }],
  })) as string

  return `https://sepolia.etherscan.io/tx/${txHash}`
}
