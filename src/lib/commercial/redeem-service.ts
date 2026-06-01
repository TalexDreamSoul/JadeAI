import { parseJsonObject } from './json';
import { grantCommercialBenefits } from './benefit-service';
import {
  notificationStoreRepository,
  redeemCodeRepository,
} from '@/lib/db/repositories/commercial.repository';

type ClaimRedeemCodeInput = {
  userId: string;
  code: string;
};

function assertRedeemable(code: Awaited<ReturnType<typeof redeemCodeRepository.findByCode>>) {
  if (!code || code.status !== 'active') {
    throw new Error('兑换码不存在或已失效');
  }

  const now = new Date();
  if (code.startsAt && code.startsAt > now) {
    throw new Error('兑换码尚未开始');
  }
  if (code.expiresAt && code.expiresAt <= now) {
    throw new Error('兑换码已过期');
  }
}

function assertRedeemCodeStock(code: NonNullable<Awaited<ReturnType<typeof redeemCodeRepository.findByCode>>>) {
  if (Number(code.claimedCount || 0) >= Number(code.maxClaims || 0)) {
    throw new Error('兑换码已领完');
  }
}

export async function claimRedeemCode(input: ClaimRedeemCodeInput) {
  const normalizedCode = input.code.trim().toUpperCase();
  if (!normalizedCode) throw new Error('请输入兑换码');

  const redeemCode = await redeemCodeRepository.findByCode(normalizedCode);
  assertRedeemable(redeemCode);

  if (!redeemCode) throw new Error('兑换码不存在或已失效');
  const claimed = await redeemCodeRepository.hasClaimed(redeemCode.id, input.userId);
  if (claimed) throw new Error('你已经领取过该兑换码');
  assertRedeemCodeStock(redeemCode);

  const claim = await redeemCodeRepository.createClaim({
    redeemCodeId: redeemCode.id,
    userId: input.userId,
    metadata: { code: normalizedCode },
  });
  if (claim.status === 'already_claimed') throw new Error('你已经领取过该兑换码');
  if (claim.status === 'out_of_stock' || !claim.id) throw new Error('兑换码已领完');
  const claimId = claim.id;

  let granted: Array<Record<string, unknown>>;
  try {
    granted = await grantCommercialBenefits({
      userId: input.userId,
      benefit: parseJsonObject(redeemCode.benefit),
      source: 'redeem_code',
      sourceId: claimId,
    });
  } catch (error) {
    await redeemCodeRepository.markClaimFailed(redeemCode.id, input.userId, {
      code: normalizedCode,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!(await notificationStoreRepository.hasSource(input.userId, 'redeem_code', claimId))) {
    await notificationStoreRepository.create({
      userId: input.userId,
      type: 'redeem_code',
      title: '兑换码领取成功',
      description: `兑换码 ${normalizedCode} 的福利已到账。`,
      actionUrl: '/zh/account',
      metadata: { claimId, sourceId: claimId, redeemCodeId: redeemCode.id, granted },
    });
  }

  return { claimId, granted };
}
