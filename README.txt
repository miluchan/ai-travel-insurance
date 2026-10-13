V2.2.2.3
Targeted fixes only:
1. 繳費完成 ->「要，確定出單」 now resolves the actual Journey ID before calling
   the existing idempotent issue-policy API. This fixes the no-response click.
2. 投保清單 rows whose status is 已出單 are wired directly at the rendered-row level:
   execution button = 旅程服務, and clicking it opens the same Travel Mode.
No changes to payment, policy DB schema, underwriting, checkpoints or prior purchase flow.
