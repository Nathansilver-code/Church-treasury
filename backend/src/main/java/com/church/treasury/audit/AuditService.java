package com.church.treasury.audit;

import com.church.treasury.repository.AuditRepository;
import com.church.treasury.repository.AuditRepository.Entry;
import com.church.treasury.repository.AuditRepository.Stored;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.HexFormat;
import org.springframework.stereotype.Service;

/**
 * Writes the audit log. Each entry stores a hash that includes the previous
 * entry's hash, so changing or removing an old entry breaks the chain.
 */
@Service
public class AuditService {

    private final AuditRepository repo;

    public AuditService(AuditRepository repo) {
        this.repo = repo;
    }

    public void log(String action, String entityType, Long entityId, String oldValue, String newValue, String reason) {
        String prev = repo.lastHash();
        String ts = Instant.now().toString();
        String hash = computeHash(prev, ts, action, entityType, entityId, oldValue, newValue, reason);
        repo.insert(ts, action, entityType, entityId, oldValue, newValue, reason, prev, hash);
    }

    public List<Entry> search(LocalDate from, LocalDate to, String action, String text) {
        return repo.search(from, to, action, text, 500);
    }

    public record Verification(boolean ok, int entries, Long brokenAtId, String problem) {}

    /** Re-checks every entry: its own hash, and that it points at the entry before it. */
    public Verification verify() {
        String expectedPrev = null;
        int count = 0;
        for (Stored s : repo.allInOrder()) {
            Entry e = s.entry();
            count++;
            boolean sameLink = expectedPrev == null ? s.prevHash() == null : expectedPrev.equals(s.prevHash());
            if (!sameLink) {
                return new Verification(false, count, e.id(), "An entry before this one was changed or removed.");
            }
            String again = computeHash(s.prevHash(), e.ts(), e.action(), e.entityType(), e.entityId(),
                e.oldValue(), e.newValue(), e.reason());
            if (!again.equals(s.hash())) {
                return new Verification(false, count, e.id(), "This entry was changed after it was written.");
            }
            expectedPrev = s.hash();
        }
        return new Verification(true, count, null, null);
    }

    private static String computeHash(String prev, String ts, String action, String entityType, Long entityId,
                                      String oldValue, String newValue, String reason) {
        return sha256(String.join("|",
            nz(prev), ts, action, nz(entityType), String.valueOf(entityId), nz(oldValue), nz(newValue), nz(reason)));
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
